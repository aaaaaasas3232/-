/**
 * 候鸟（旅游 App）· 常量
 *
 * ★ 这个文件不含任何颜色。颜色的唯一真相在 `css/apps/travel/index.css`
 *   的 token 段（--tv-*），元信息在 `theme.js`。
 */

/** IndexedDB 表名。声明见 services/db.js 的 TRAVEL_STORES，登记见 src/core/db-catalog.js */
export const STORES = Object.freeze({
    profiles: 'travelProfiles',
    feeds: 'travelFeeds',
    destinations: 'travelDestinations',
    trips: 'travelTrips',
    messages: 'travelMessages',
});

/** 底栏 tab */
export const TABS = Object.freeze([
    { id: 'explore', label: '探索', icon: 'compass' },
    { id: 'trips', label: '行程', icon: 'ticket' },
    { id: 'footprints', label: '足迹', icon: 'footprints' },
    { id: 'companions', label: '经历', icon: 'users' },
    { id: 'me', label: '我的', icon: 'user' },
]);

/** 一批候选地点的数量 */
export const FEED_SIZE = 6;

/** 行程状态 */
export const TRIP_STATUS = Object.freeze({
    /** 已买票，还没出发（可退票删除） */
    prepared: 'prepared',
    /** 旅行中（对话页开着） */
    ongoing: 'ongoing',
    /** 已结束（进足迹，不能自动退款） */
    completed: 'completed',
});

/** 一天的三个时段。slot 索引 = day*3 + phase */
export const DAY_PHASES = Object.freeze([
    { id: 'morning', label: '早' },
    { id: 'noon', label: '午' },
    { id: 'evening', label: '晚' },
]);

/** 天数可选范围 */
export const TRIP_DAYS_MIN = 1;
export const TRIP_DAYS_MAX = 7;

/** 资产流水的稳定来源类型（幂等 / 退款凭据，发布后不能改） */
export const FLOW_SOURCE = Object.freeze({
    ticket: 'travel-ticket',
});

/** 背景图上传的大小上限（dataUrl 字符数，约 1.4MB 原图） */
export const BG_DATAURL_MAX = 1900000;

/** 背景模糊度范围（px） */
export const BG_BLUR_MAX = 20;

/** API 超时（毫秒） */
export const TIMEOUT = Object.freeze({
    normal: 90000,
    short: 45000,
});

/** 所有要 JSON 的地方共用这一句 */
export const JSON_RULE = '只输出一个 JSON 对象。不要 markdown 围栏，不要解释，不要在 JSON 前后加任何文字。';

/** murmur 折叠组里静态提示词的稳定 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'travel-shared',
    tripPrefix: 'trip-',
});
