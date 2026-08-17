/**
 * 氧气（博客 App，id: blog）· 常量
 *
 * ★ 这个文件不含任何颜色。颜色的唯一真相在 `css/apps/blog/index.css`
 *   的 token 段（--ox-*），元信息在 theme.js。
 * ★ 氧气值 / 小听的数值常量全部集中在这里，改平衡不用翻业务代码。
 */

/** IndexedDB 表名。声明见 services/db.js 的 BLOG_STORES，登记见 src/core/db-catalog.js */
export const STORES = Object.freeze({
    // 按档案键（`${userId}::${worldId}`）分档
    profiles: 'blogProfiles',
    feeds: 'blogFeeds',
    posts: 'blogPosts',
    authors: 'blogAuthors',
    comments: 'blogComments',
    hot: 'blogHotSearch',
    chats: 'blogChats',
    dms: 'blogDms',
    // 全局档（属于屏幕前的人，不分用户卡 / 世界）
    essays: 'blogEssays',
    oxygen: 'blogOxygen',
    room: 'blogRoomItems',
    geometries: 'blogGeometries',
    xiaoting: 'blogXiaoting',
    blackbox: 'blogBlackbox',
});

/** 全局档记录的固定主键（这些表一人一份，不分档） */
export const GLOBAL_KEY = 'global';

/** 底栏 tab */
export const TABS = Object.freeze([
    { id: 'square', label: '广场', icon: 'square' },
    { id: 'discover', label: '发现', icon: 'discover' },
    { id: 'room', label: '房间', icon: 'room' },
    { id: 'essays', label: '随笔', icon: 'essay' },
    { id: 'me', label: '我的', icon: 'me' },
]);

/** 帖子三种类型 */
export const POST_TYPES = Object.freeze([
    { id: 'long', label: '长文' },
    { id: 'short', label: '短文' },
    { id: 'murmur', label: '碎碎念' },
]);

export function postTypeLabel(id) {
    return (POST_TYPES.find((t) => t.id === id) || POST_TYPES[1]).label;
}

/** 一批广场列表的数量 */
export const FEED_SIZE = 10;

/** 每次「更多评论」增加的条数（与萤火一致） */
export const COMMENT_PAGE = 5;

/** 数字显示上限：超过显示 99+（内部仍保存真实数值） */
export const COUNT_CAP = 99;

/** 一批热搜词条数量 */
export const HOT_SIZE = 10;

/** 一个热搜词条下生成的帖子数量 */
export const TERM_POST_SIZE = 6;

/** 一次私信收件生成的条数 */
export const DM_BATCH = 4;

/** 站内闲聊：多少条以上出现「加为好友」引导 */
export const FRIEND_HINT_AFTER = 6;

/** API 超时（毫秒） */
export const TIMEOUT = Object.freeze({
    normal: 90000,
    short: 45000,
});

/** 所有要 JSON 的地方共用这一句 */
export const JSON_RULE = '只输出一个 JSON 对象。不要 markdown 围栏，不要解释，不要在 JSON 前后加任何文字。';

/** murmur 折叠组里提示词的稳定 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'blog-shared',
    shareAction: 'blog-share-action',
    blackbox: 'blackbox',
});

/** 聊天卡消息类型（写入 type / message-renderer 注册表 / share-cards 渲染器三处对齐） */
export const CHAT_CARD_TYPE = 'blog_post_share';

/** 跨 App 内容卡的 entityType（services.contentCards 按它路由） */
export const CARD_ENTITY = 'blog-post';

/** 关注规模预设（决定评论量与私信风向，数值进 JS 计算） */
export const FOLLOWER_PRESETS = Object.freeze([
    { id: 'zero', label: '刚注册', desc: '没有人认识你', followers: 0 },
    { id: 'tiny', label: '小透明', desc: '几十个熟人', followers: 60 },
    { id: 'small', label: '小有名气', desc: '一千上下', followers: 1400 },
    { id: 'mid', label: '中腰部', desc: '几万关注', followers: 52000 },
    { id: 'big', label: '大 V', desc: '百万级', followers: 1200000 },
]);

// ============================================================
// 氧气值（全部可调，engine 只读这里）
// ============================================================

export const OXYGEN = Object.freeze({
    MAX: 100,
    /** 表达增益 */
    GAIN: Object.freeze({
        long: 8,
        short: 5,
        murmur: 3,
        essay: 3,
        meditation: 4,
    }),
    /** 同一自然日第 N 次表达起收益减半 */
    DIMINISH_AFTER: 3,
    /** 每个未表达的自然日扣多少 */
    DAILY_DECAY: 6,
    /** 单次补扣上限（离开很多天回来也不会一口气扣穿） */
    DECAY_CAP: 30,
    /** 低氧阈值：电池变红 + 首页出现「呼吸有点浅了」 */
    LOW_THRESHOLD: 20,
    /** 流水最多保留多少条 */
    LEDGER_CAP: 200,
});

/** localStorage 键（登记见 src/core/db-catalog.js 的 LOCAL_STORAGE_KEYS） */
export const LS_KEYS = Object.freeze({
    /** 氧气归零标记：{ at, count }，下次刷新触发关机彩蛋 */
    shutdownPending: 'xiaoting::oxygen-shutdown-pending',
    /** 关机输入框的暂存（3C 把它迁移进小听记忆） */
    shutdownNotes: 'xiaoting::oxygen-shutdown-notes',
    /** 黑匣子开关的同步镜像（chat 侧解析时同步读，真相在 blogOxygen 表） */
    blackboxEnabled: 'xiaoting::oxygen-blackbox-enabled',
});

// ============================================================
// 冥想空间与小听（全部可调）
// ============================================================

export const XIAOTING = Object.freeze({
    /** 颜色 lightness 0~100，越浅越健康 */
    COLOR_INIT: 85,
    COLOR_MIN: 22,
    COLOR_MAX: 96,
    /** 每次整理后按 mood 漂移的幅度范围 */
    COLOR_DRIFT_MIN: 2,
    COLOR_DRIFT_MAX: 6,
    /** 出现机制 */
    APPEAR_FREE_SESSIONS: 2,      // 前 N 次整理永不出现
    APPEAR_BASE: 0.05,            // 基础概率
    APPEAR_PER_NEGATIVE: 0.15,    // 每一连败（低落场次）加多少
    APPEAR_MIN_WHEN_VERY_LOW: 0.6, // 单次 mood ≤ -2 的保底
    APPEAR_CAP: 0.85,             // 封顶
    APPEAR_DROP_PER_POSITIVE: 0.10, // 连续正向每次降多少
    /** 出现过之后的常驻倾向 */
    STAY_WHEN_LOW: 0.9,           // 用户低落时几乎总在
    STAY_WHEN_FINE: 0.35,         // 状态好时常常不在（去玩了）
    /** 记忆碎片上限 */
    MEMORY_CAP: 50,
    /** 恶作剧 */
    PRANK_MIN_GAP_MS: 72 * 60 * 60 * 1000,
    PRANK_CHANCE: 0.25,
    PRANK_QUIET_FROM: 23,          // 23:00 起
    PRANK_QUIET_TO: 7,             // 到 7:00 都不打扰
    /** 房间几何体上限，满了最旧的进抽屉 */
    GEOMETRY_ROOM_CAP: 24,
});

/** 几何体白名单（AI 只能从这里挑；颜色由 JS 按小听颜色派生，不由 AI 定） */
export const SHAPES = Object.freeze([
    { id: 'cube', label: '立方' },
    { id: 'sphere', label: '球' },
    { id: 'pyramid', label: '棱锥' },
    { id: 'ring', label: '圆环' },
    { id: 'prism', label: '棱柱' },
]);

export const SHAPE_IDS = Object.freeze(SHAPES.map((s) => s.id));

export const SIZE_HINTS = Object.freeze(['小', '中', '大']);

/** 整理链每步的用户可见文案（只有一行小字，不说教） */
export const ORGANIZE_STEPS = Object.freeze([
    '把纸条轻轻捋一遍',
    '安静地读一读',
    '也许有一份小礼物',
]);
