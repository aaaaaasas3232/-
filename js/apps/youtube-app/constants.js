/**
 * 萤火（视频 App）· 常量
 *
 * ★ 这个文件不含任何颜色。颜色的唯一真相在 `css/apps/youtube/index.css`
 *   的 token 段（--yt-*），元信息在 theme.js。
 */

/** IndexedDB 表名。声明见 services/db.js 的 YOUTUBE_STORES，登记见 src/core/db-catalog.js */
export const STORES = Object.freeze({
    profiles: 'youtubeProfiles',
    feeds: 'youtubeFeeds',
    videos: 'youtubeVideos',
    creators: 'youtubeCreators',
    comments: 'youtubeComments',
    lives: 'youtubeLives',
    uploads: 'youtubeUploads',
    chats: 'youtubeChats',
    dms: 'youtubeDms',
});

/** 底栏 tab */
export const TABS = Object.freeze([
    { id: 'home', label: '首页', icon: 'play' },
    { id: 'channels', label: '频道', icon: 'tower' },
    { id: 'saved', label: '收藏', icon: 'star' },
    { id: 'inbox', label: '消息', icon: 'mail' },
    { id: 'me', label: '我的', icon: 'user' },
]);

/** 一批视频列表的数量 */
export const FEED_SIZE = 8;

/** 每次「更多评论」增加的条数（全 App 统一，博客以后也用这个数） */
export const COMMENT_PAGE = 5;

/** 评论显示上限：超过显示 99+（内部仍保存真实数值） */
export const COUNT_CAP = 99;

/** 一次私信收件生成的条数范围 */
export const DM_BATCH = Object.freeze({ min: 3, max: 6 });

/** 直播判定窗口（毫秒）：同一窗口内主播的开播状态不变 */
export const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** 主播在某个窗口内开播的概率（0~1，由 seeded RNG 判定，不调 AI） */
export const LIVE_CHANCE = 0.38;

/** 弹幕池条数范围（一次 API 生成，JS 分发） */
export const DANMAKU_POOL = Object.freeze({ min: 22, max: 36 });

/** 站内闲聊：多少条以上出现「加为好友」引导 */
export const FRIEND_HINT_AFTER = 6;

/** 用户上传封面文字长度上限 */
export const COVER_TEXT_MAX = 12;

/** API 超时（毫秒） */
export const TIMEOUT = Object.freeze({
    normal: 90000,
    short: 45000,
});

/** 所有要 JSON 的地方共用这一句 */
export const JSON_RULE = '只输出一个 JSON 对象。不要 markdown 围栏，不要解释，不要在 JSON 前后加任何文字。';

/** murmur 折叠组里静态提示词的稳定 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'youtube-shared',
    shareAction: 'youtube-share-action',
});

/** 聊天卡消息类型（写入 type / message-renderer 注册表 / share-cards 渲染器三处对齐） */
export const CHAT_CARD_TYPE = 'youtube_video_share';

/** 跨 App 内容卡的 entityType（services.contentCards 按它路由） */
export const CARD_ENTITY = 'youtube-video';

/** 站内用户身份 */
export const PERSON_KIND = Object.freeze({
    creator: 'creator',   // 有作品的频道主
    viewer: 'viewer',     // 评论区认识的观众
    ai: 'ai',             // 当前世界绑定的 AI（频道 id = ai::aiPersonId）
});

/** AI 频道 id 前缀（稳定，不能改） */
export const AI_CREATOR_PREFIX = 'ai::';

/** 视频封面的色相槽位数（对应 CSS 里 --yt-cover-0 ~ --yt-cover-7） */
export const COVER_HUES = 8;

/** 粉丝规模预设（首配可选，之后随时可改；数值进 JS 计算，不进 prompt 原文） */
export const FOLLOWER_PRESETS = Object.freeze([
    { id: 'zero', label: '刚注册', desc: '没有人认识你', followers: 0 },
    { id: 'tiny', label: '小透明', desc: '几十个熟人关注', followers: 40 },
    { id: 'small', label: '小有名气', desc: '一千上下', followers: 1200 },
    { id: 'mid', label: '中腰部', desc: '几万粉丝', followers: 46000 },
    { id: 'big', label: '大频道', desc: '百万级', followers: 1350000 },
]);

/** 私信 provider 开关的存储字段名（存在 profile 上，按档案隔离） */
export const PROVIDER_PREF_FIELD = 'providerPrefs';
