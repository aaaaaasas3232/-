/**
 * 四叶草 · 常量
 *
 * ★ 这个文件里**一个颜色都没有**。颜色全在 `css/apps/shop/_theme.css`。
 *   梦境编织那轮的教训：只要 JS 里还有 hex，换主题换的就是个寂寞。
 *
 * 「档案键」这个概念贯穿全 App，先在这里说清楚：
 *   一份购物数据属于「哪个默认用户 + 哪个世界观」这一对组合，
 *   键就是 `${userId}::${worldId}`。切默认用户换了世界观 → 键变了 →
 *   读不到配置 → 走首配；切回来 → 键又对上 → 原样恢复。
 *   这比「切用户时清空再重建」可靠得多，因为它根本不需要「切换」这个事件到达。
 */

export const APP_ID = 'shop';

/** IndexedDB 表名。加表记得去 `src/core/db-catalog.js` 登记一条。 */
export const STORES = Object.freeze({
    profiles: 'shopProfiles',   // 每档一条：配置 / 心愿单 / 主题 / 已收礼物
    items: 'shopItems',         // 收藏的商品与店铺（只有收藏的才进来）
    feeds: 'shopFeeds',         // 每档每种列表一条：当前这批列表（刷新即覆盖）
    orders: 'shopOrders',       // 订单 / 礼物流水
    theaters: 'shopTheaters',   // 小剧场
});

/** 底部 tab */
export const TABS = Object.freeze([
    { id: 'market', label: '商品', icon: 'bag' },
    { id: 'dine', label: '探店', icon: 'store' },
    { id: 'cart', label: '购物车', icon: 'cart' },
    { id: 'me', label: '我的', icon: 'user' },
]);

/** 列表种类。两种列表共用同一套「生成 → 卡片 → 详情」流程，只有提示词不同。 */
export const FEED_KINDS = Object.freeze({
    product: 'product',
    store: 'store',
});

/** 店铺的两种消费方式 —— 这个 App 更像探店而不是纯外卖 */
export const SERVE_MODES = Object.freeze([
    { id: 'dinein', label: '到店', icon: 'pin' },
    { id: 'delivery', label: '外送', icon: 'truck' },
]);

/** 商品分类。AI 生成时会被要求从这里挑，避免每次刷新分类都换一套。 */
export const PRODUCT_CATEGORIES = Object.freeze([
    '全部', '穿搭', '美妆', '居家', '数码', 'food', '文创', '其他',
].map((x) => (x === 'food' ? '食品' : x)));

export const STORE_CATEGORIES = Object.freeze([
    '全部', '正餐', '咖啡', '甜品', '小吃', '酒馆', '其他',
]);

/** 一次生成几条。再多 AI 容易糊弄，再少不够翻。 */
export const FEED_SIZE = 8;

/** 小剧场篇幅档位 */
export const THEATER_LENGTHS = Object.freeze([
    { id: 'short', label: '短', words: '300~500 字' },
    { id: 'medium', label: '中', words: '600~900 字' },
    { id: 'long', label: '长', words: '1200~1600 字' },
]);

/** 小剧场的场合。决定 prompt 的开场设定。 */
export const THEATER_OCCASIONS = Object.freeze([
    { id: 'purchase', label: '收到商品', hint: '快递到了 / 拆包装' },
    { id: 'dinein', label: '一起到店', hint: '在店里吃/喝' },
    { id: 'delivery', label: '外送到家', hint: '外卖送到门口' },
    { id: 'gift-out', label: '送出礼物', hint: '把礼物交给对方' },
    { id: 'gift-in', label: '收到礼物', hint: '对方送你东西' },
]);

/** 超时。流式用空闲超时（连续多久没数据才算挂），不是总时长。 */
export const TIMEOUT = Object.freeze({
    normal: 90000,
    streamIdle: 60000,
});

/**
 * 提示词里给 AI 的输出契约。
 *
 * 嵌套结构一律要 JSON，不用自定义分隔符 —— 分隔符少一个符号会解析歪
 * 而且看不出来（AGENTS2 §13.6.2）。
 */
export const JSON_RULE = `只输出一个 JSON，不要任何解释文字，不要 markdown 代码围栏。`;

/** localStorage：跨 App 只读的实时上下文用不到它，这里只存「上次用的档案键」做启动加速 */
export const LAST_PROFILE_KEY = 'xiaoting::shop-last-profile-v1';

/** 生成中的可爱加载文案。按种类分，避免商品和店铺都说同一句。 */
export const LOADING_LINES = Object.freeze({
    product: ['正在翻货架', '在挑给你的那一件', '正在核对标价'],
    store: ['正在打听这家店', '在看今天有没有位子', '正在闻厨房的味道'],
    detail: ['正在把它拿到你面前', '在看清楚每一个细节', '正在问店员'],
    theater: ['正在开场', '灯光暗下来了', '在等他们开口'],
    summary: ['正在写一句话概要'],
});

/** 资金流水的来源类型。写进 `sdk.assetFlow` 的 `sourceType`。 */
export const FLOW_SOURCE = Object.freeze({
    purchase: 'shop-purchase',   // 用户自己买
    giftOut: 'shop-gift-out',    // 用户送 AI
    giftIn: 'shop-gift-in',      // AI 送用户
});

/** 心愿单一次最多几条。超过之后实时 prompt 会太长。 */
export const WISHLIST_MAX = 12;
