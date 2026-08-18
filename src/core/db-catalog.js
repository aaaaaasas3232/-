/**
 * 数据库目录 —— 全系统数据表的唯一一份说明书
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────
 * 这个项目的表分散在三个地方长出来：
 *   1. `js/db/base-stores.js`     启动时无条件建的一批（含大量早期遗留表）
 *   2. `appConfig.stores`         各 App 自己声明的
 *   3. 「就这么用了」的            代码里直接 `db.getAll('xxx')`，谁都没声明
 *
 * 第三类是最麻烦的：读写都不报错（store-api 里全是 try/catch 兜底），
 * 表现只是「存了但下次进来没有」。cover-designer 的 `cdCustomFonts` /
 * `cdPreferences` 就在这个状态待了很久。
 *
 * 而 nook 的「数据库」页此前是把表名**硬编码**在 UI 文件里的，
 * 新 App 加表不会自动出现在那里 —— 于是这份清单和真实数据库越差越远。
 *
 * 这个文件把三件事统一了：
 *   - 每张表归谁、干什么、主键是什么，写在一处
 *   - nook 的数据库页从这里读，不再自己维护列表
 *   - `auditStores()` 把「实际有的」「声明了的」「登记了的」三方对账，
 *     漂移当场看得见，而不是等用户报「数据丢了」
 */

/** 分类：数据库页按这个分组显示，顺序即展示顺序 */
export const DB_CATEGORIES = [
    { id: 'identity', label: '用户与人设', desc: '你和 AI 的身份、形象、社媒资料' },
    { id: 'world', label: '世界观', desc: '世界、组、地点、场所、阵营、标签' },
    { id: 'persona-daily', label: '人设日常', desc: '日记 / 日程 / 周历 / 草稿 / 激活状态' },
    { id: 'api', label: 'API 管理', desc: '密钥、分组、调用日志' },
    { id: 'prompt', label: 'Prompt 系统', desc: '跨 App 注册的提示词与用户改动' },
    { id: 'chat', label: 'murmur（聊天）', desc: '消息、归档、收藏、故事存档' },
    { id: 'music', label: '音乐', desc: '喜欢、歌单、播放历史、一起听' },
    { id: 'creation', label: '创作类 App', desc: '封面设计、梦境编织' },
    { id: 'relax', label: '解压舞台', desc: '舞台存档与用户素材' },
    { id: 'device', label: '设备与外观', desc: '手机壳、壁纸、通用设置' },
    { id: 'misc', label: '其他 App', desc: '天气等' },
    { id: 'legacy', label: '历史遗留', desc: '早期版本留下的表，现在基本没人读' },
];

/**
 * 表清单。
 *
 * owner       哪个 App 拥有它（appId；'framework' 表示框架级）
 * declaredIn  在哪儿声明的：'base' = js/db/base-stores.js，'app' = appConfig.stores
 * keyPath     主键字段
 * desc        这张表存什么
 * note        踩过的坑 / 命名解释 / 迁移状态，可选
 */
export const DB_STORES = [
    // ── 用户与人设 ──────────────────────────────────────────────
    { name: 'sdkUsers', category: 'identity', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '「我」的用户卡：昵称、头像、简介，以及各 App 里的社媒形象', note: 'socialProfiles[appId] 挂在这条记录上，不是独立表' },
    { name: 'sdkAiPersons', category: 'identity', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: 'AI 人设：名字、性格、说话风格、绑定的世界观' },
    { name: 'sdkActive', category: 'identity', owner: 'settings', declaredIn: 'base+app', keyPath: 'key', desc: '当前激活的是哪个用户 / 哪个 AI / 哪个世界观', note: '单行配置表，key 是配置名' },

    // ── 世界观 ─────────────────────────────────────────────────
    { name: 'sdkWorlds', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '世界观本体' },
    { name: 'sdkWorldGroups', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '世界观分组' },
    { name: 'sdkPlaces', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '地点：一张箱庭地图的容器' },
    { name: 'sdkLocations', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '场所：挂在某个地点上的一个 pin' },
    { name: 'sdkFactions', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '阵营 / 势力' },
    { name: 'sdkTagGroups', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '标签分组' },
    { name: 'sdkTags', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '标签' },
    { name: 'sdkSnapshots', category: 'world', owner: 'settings', declaredIn: 'base+app', keyPath: 'key', desc: '世界观快照：某一时刻的完整状态备份' },

    // ── 人设日常 ────────────────────────────────────────────────
    { name: 'sdkDrafts', category: 'persona-daily', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '编辑中的草稿，防止填一半丢失' },
    { name: 'sdkDiaries', category: 'persona-daily', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '人设日记', note: 'id = `${entityType}:${entityId}:${date}`，一天一条' },
    { name: 'sdkSchedules', category: 'persona-daily', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '某一天的日程', note: 'id = `${entityType}:${entityId}:${date}`' },
    { name: 'sdkWeeklySchedules', category: 'persona-daily', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '每周重复的日程', note: 'id = `${entityType}:${entityId}:${dayOfWeek}`' },

    // ── API ────────────────────────────────────────────────────
    { name: 'apiKeys', category: 'api', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: 'API 密钥：地址、模型、启停状态' },
    { name: 'apiGroups', category: 'api', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: 'API 分组：一组 key 轮询用' },
    { name: 'apiUsageLogs', category: 'api', owner: 'settings', declaredIn: 'base+app', keyPath: 'id', desc: '调用日志：耗时、token、成败' },
    { name: 'apiProfiles', category: 'api', owner: 'settings', declaredIn: 'base+app', keyPath: 'key', desc: '旧版 API 配置', note: '已被 apiKeys 取代，保留是为了老数据能读出来' },

    // ── 框架级共享 ──────────────────────────────────────────────
    { name: 'sharedRecords', category: 'prompt', owner: 'framework', declaredIn: 'shared', keyPath: 'id', desc: 'App 之间互相分享的记录（toolkit.shared）', note: '每个 App 注册时都会自动带上这张表，见 src/core/store-api.js 的 SHARED_STORES' },

    // ── Prompt 系统 ────────────────────────────────────────────
    { name: 'appPromptStates', category: 'prompt', owner: 'framework', declaredIn: 'base', keyPath: 'key', desc: '各 App 注册的提示词，用户改过的启停 / 正文 / 顺序', note: 'key = `${appId}::${promptId}`。注册表本身在内存里，每次启动重建；这张表只存用户的改动，所以 App 卸载重装后用户设置还在' },

    // ── murmur ────────────────────────────────────────────────
    { name: 'chatMessages', category: 'chat', owner: 'chat', declaredIn: 'base', keyPath: 'id', desc: '当天的聊天消息', note: '只留当天，昨天及更早由归档任务搬进 chatArchiveMessages' },
    { name: 'chatArchiveMessages', category: 'chat', owner: 'chat', declaredIn: 'base', keyPath: 'id', desc: '归档消息，字段同 chatMessages 加 archivedAt / archivedDay' },
    { name: 'sdkChatFavorites', category: 'chat', owner: 'chat', declaredIn: 'base', keyPath: 'id', desc: '单条消息收藏', note: '和消息解耦：消息删了收藏还在' },
    { name: 'sdkStoryArchives', category: 'chat', owner: 'chat', declaredIn: 'base', keyPath: 'id', desc: '故事模式的整段封存快照' },

    // ── 音乐 ───────────────────────────────────────────────────
    { name: 'likedSongs', category: 'music', owner: 'music', declaredIn: 'app', keyPath: 'songId', desc: '喜欢的歌' },
    { name: 'playlists', category: 'music', owner: 'music', declaredIn: 'app', keyPath: 'id', desc: '自建歌单' },
    { name: 'playHistory', category: 'music', owner: 'music', declaredIn: 'app', keyPath: 'id', desc: '播放历史' },
    { name: 'listenTogetherSessions', category: 'music', owner: 'music', declaredIn: 'app', keyPath: 'sessionId', desc: '一起听的房间状态' },

    // ── 创作类 ─────────────────────────────────────────────────
    { name: 'cdDesigns', category: 'creation', owner: 'cover-designer', declaredIn: 'app', keyPath: 'id', desc: '封面设计稿存档（含缩略图）', indexes: ['updatedAt'] },
    { name: 'cdCustomFonts', category: 'creation', owner: 'cover-designer', declaredIn: 'app', keyPath: 'id', desc: '用户粘贴的自定义字体片段', note: '2026-08 之前漏声明，写入一直静默失败' },
    { name: 'cdPreferences', category: 'creation', owner: 'cover-designer', declaredIn: 'app', keyPath: 'key', desc: '封面设计的用户偏好', note: '同上，keyPath 是 key 不是 id' },
    { name: 'dwBooks', category: 'creation', owner: 'dream-weaver', declaredIn: 'app', keyPath: 'id', desc: '梦境编织：书' },
    { name: 'dwChapters', category: 'creation', owner: 'dream-weaver', declaredIn: 'app', keyPath: 'id', desc: '梦境编织：章节', indexes: ['bookId'] },
    { name: 'dwLibrary', category: 'creation', owner: 'dream-weaver', declaredIn: 'app', keyPath: 'id', desc: '梦境编织：书库级设置与素材' },
    { name: 'plDrafts', category: 'creation', owner: 'persona-lab', declaredIn: 'app', keyPath: 'id', desc: '人设机：人设草稿（正文 + 对话 + 修改日志）', indexes: ['updatedAt'], note: '人设卡本体不在这里，真理之源是 sdkUsers / sdkAiPersons' },
    { name: 'plQuizSets', category: 'creation', owner: 'persona-lab', declaredIn: 'app', keyPath: 'id', desc: '人设机：用户导入的题库', indexes: ['updatedAt'], note: '内置那 6 套是代码常量，不在这张表里' },

    // ── 解压 ───────────────────────────────────────────────────
    { name: 'relaxScenes', category: 'relax', owner: 'relax', declaredIn: 'app', keyPath: 'id', desc: '舞台存档', note: "id='current' 是当前正在用的那套，其余是另存的" },
    { name: 'relaxSounds', category: 'relax', owner: 'relax', declaredIn: 'app', keyPath: 'id', desc: '用户上传的自定义音（dataUrl）' },
    { name: 'relaxImages', category: 'relax', owner: 'relax', declaredIn: 'app', keyPath: 'id', desc: '用户上传的背景图（dataUrl）' },
    { name: 'relaxPlates', category: 'relax', owner: 'relax', declaredIn: 'app', keyPath: 'id', desc: '底板' },
    { name: 'relaxDecorations', category: 'relax', owner: 'relax', declaredIn: 'app', keyPath: 'id', desc: '装饰物' },

    // ── 小奇怪 ─────────────────────────────────────────────────
    // 早年那批单文件 HTML 原型合集（双人扫雷 / 你有我没有 / 果冻心 / 手风琴 /
    // 沙漏 / 开屏艺术字 / 字幕生成器）。三张表都很小，不存大对象。
    { name: 'oqLibrary', category: 'misc', owner: 'oddity', declaredIn: 'app', keyPath: 'id', desc: '小奇怪：设置、主题、字幕收藏、解锁记录', note: "单例表，id 恒为 'root'" },
    { name: 'oqGames', category: 'misc', owner: 'oddity', declaredIn: 'app', keyPath: 'id', desc: '小奇怪：进行中的对局（双人扫雷 / 你有我没有）与归档', note: "进行中的用固定 id（minesweeper / haveyou），打完归档的那份才用 arc- 前缀 + 时间戳" },
    { name: 'oqScores', category: 'misc', owner: 'oddity', declaredIn: 'app', keyPath: 'id', desc: '小奇怪：历次对局的战绩' },
    { name: 'oqAnon', category: 'misc', owner: 'oddity', declaredIn: 'app', keyPath: 'id', desc: '小奇怪：匿名回答箱 / 匿名收信箱 / 漂流瓶', note: "三条单例记录，id 恒为 askbox / letterbox / bottle；单独成表是因为每回一句话就要落盘一次，合进 oqLibrary 会连带把上百条收藏重新序列化" },

    // ── 四叶草购物 ─────────────────────────────────────────────
    // 五张表全部按「档案键」（`${userId}::${worldId}`）分档：
    // 换个默认用户、而他绑的是另一个世界观 → 键对不上 → 走首次配置；
    // 换回来 → 键又对上 → 原样恢复。
    { name: 'shopProfiles', category: 'misc', owner: 'shop', declaredIn: 'app', keyPath: 'id', desc: '四叶草：一档的配置 / 心愿单 / 购物车 / 配色', note: 'id 就是档案键本身' },
    { name: 'shopItems', category: 'misc', owner: 'shop', declaredIn: 'app', keyPath: 'id', desc: '四叶草：收藏的商品与店铺', note: '只有收藏过的才进来；没收藏的活在 shopFeeds 里，刷新即弃' },
    { name: 'shopFeeds', category: 'misc', owner: 'shop', declaredIn: 'app', keyPath: 'id', desc: '四叶草：当前这批列表', note: 'id = `${档案键}::${kind}`，刷新即覆盖，永远只有两条，不累积' },
    { name: 'shopOrders', category: 'misc', owner: 'shop', declaredIn: 'app', keyPath: 'id', desc: '四叶草：订单与收发的礼物' },
    { name: 'shopTheaters', category: 'misc', owner: 'shop', declaredIn: 'app', keyPath: 'id', desc: '四叶草：小剧场（结构化台词 + 概要）', note: '给将来的「情景聊天」App 留的数据源，取用走 appConfig.services.getTheater' },

    // ── 灯塔求职 ───────────────────────────────────────────────
    // 六张表同样按「档案键」（`${userId}::${worldId}`）分档，规则和四叶草一致。
    // 钱不在这里：工资走 sdk.assetFlow，和红包、转账、购物同一本账。
    { name: 'jobProfiles', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：一档的配置 / 配色 / 提示词改动 / 特殊岗位命名', note: 'id 就是档案键本身' },
    { name: 'jobFeeds', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：当前这批招聘信息', note: 'id = 档案键，刷新即覆盖，永远只有一条，不累积' },
    { name: 'jobItems', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：收藏的职位', note: '只有收藏过的才进来；没收藏的活在 jobFeeds 里，刷新即弃' },
    { name: 'jobPosts', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：已入职的工作（薪资 / 排班 / 同事与敌对 / 专属提示词）', note: '最多 3 份；track 字段留给以后的 idol / 博客 App 认领' },
    { name: 'jobRecruiters', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：HR 人设 + 面试对话', note: '独立成表是因为每发一条消息都要写，塞进 jobPosts 会连带重写排班和小剧场索引' },
    { name: 'jobTheaters', category: 'misc', owner: 'job', declaredIn: 'app', keyPath: 'id', desc: '灯塔：每日小剧场（结构化台词 + 当天梗概 + 当天到账）', note: '梗概会在生成下一场时被读回去，是剧情连续性的来源' },

    // ── 候鸟旅行 ───────────────────────────────────────────────
    // 五张表全部按「档案键」（`${userId}::${worldId}`）分档，规则和四叶草一致。
    // 机票钱不在这里：走 sdk.assetFlow（sourceType 'travel-ticket'），和红包、购物同一本账。
    { name: 'travelProfiles', category: 'misc', owner: 'travel', declaredIn: 'app', keyPath: 'id', desc: '候鸟：一档的首配 / 主题 / 自定义配色', note: 'id 就是档案键本身' },
    { name: 'travelFeeds', category: 'misc', owner: 'travel', declaredIn: 'app', keyPath: 'id', desc: '候鸟：当前这批候选地点', note: 'id = 档案键，刷新即覆盖，永远只有一条，不累积' },
    { name: 'travelDestinations', category: 'misc', owner: 'travel', declaredIn: 'app', keyPath: 'id', desc: '候鸟：收藏或已展开详情的候选', note: '只有收藏 / 看过详情的才进来；其余活在 travelFeeds 里，刷新即弃' },
    { name: 'travelTrips', category: 'misc', owner: 'travel', declaredIn: 'app', keyPath: 'id', desc: '候鸟：行程（票据 / 同行 / 物品 / 天数 / 状态 / 概要 / 足迹备注 / nook 登记）', note: '票据凭据 sourceType+sourceId 存在 ticket 字段里，退款按它撤销' },
    { name: 'travelMessages', category: 'misc', owner: 'travel', declaredIn: 'app', keyPath: 'id', desc: '候鸟：旅行对话（旁白 / 用户 / 各 AI 消息）', note: '按 seq 排序而不是 createdAt —— 同一毫秒插两条时时间戳会撞' },

    // ── 萤火视频 ───────────────────────────────────────────────
    // 九张表全部按「档案键」（`${userId}::${worldId}`）分档，规则和四叶草一致。
    // 视频没有真实画面：封面 = 色块 + 大字，内容 = 分段文字梗概。
    { name: 'youtubeProfiles', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：一档的首配 / 频道资料 / 图库绑定 / 头像映射 / provider 开关 / 主题', note: 'id 就是档案键本身；avatarMap 是 externalId → 图库编号的持久映射，刷新不换脸' },
    { name: 'youtubeFeeds', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：当前这批视频列表', note: 'id = 档案键，刷新即覆盖，永远只有一条，不累积' },
    { name: 'youtubeVideos', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：收藏 / 已展开详情 / 卡片重建的外部视频', note: '只有收藏、看过详情或从聊天卡进来的才入表；其余活在 youtubeFeeds 里，刷新即弃' },
    { name: 'youtubeCreators', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：站内用户（频道主 / 观众 / AI 频道）', note: 'id = `${档案键}::${creatorId}`；同名 = 同一个人，externalId 稳定不换身份' },
    { name: 'youtubeComments', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：评论（外部视频的 + 用户自己视频的）', note: '按 seq 排序而不是 createdAt —— 同一毫秒插两条时时间戳会撞' },
    { name: 'youtubeLives', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：直播场次（主播话术 + 一次生成的弹幕池 + 用户弹幕）', note: 'id 带 6 小时时间窗戳；每个主播只留最近 3 场' },
    { name: 'youtubeUploads', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：用户与世界 AI 的作品', note: '普通刷新永远不碰这张表；AI 作品只在用户点「让 TA 发视频」时生成' },
    { name: 'youtubeChats', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：站内闲聊消息', note: '刻意没有编辑 / 删除 / 重 roll 入口 —— 网友不是用户的 AI 伙伴' },
    { name: 'youtubeDms', category: 'misc', owner: 'youtube', declaredIn: 'app', keyPath: 'id', desc: '萤火：收到的私信', note: '点「收一批私信」才生成；演员 / 爱豆 / 电竞 provider 上线后会改变风向' },

    // ── 氧气博客 ───────────────────────────────────────────────
    // 前八张按「档案键」（`${userId}::${worldId}`）分档，规则和四叶草一致；
    // 后六张是**全局档**（owner 字段写 'global'）：随笔 / 氧气值 / 房间 /
    // 几何体 / 小听 / 黑匣子属于屏幕前的人，切用户卡和世界都不丢。
    { name: 'blogProfiles', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：一档的首配 / 兴趣 / 关注规模 / provider 开关 / 阅读设置 / 主题', note: 'id 就是档案键本身' },
    { name: 'blogFeeds', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：当前这批广场列表（标签级 stub，无正文）', note: 'id = 档案键，刷新即覆盖，永远只有一条；stub.seed 是展开正文的内部线索，永不渲染' },
    { name: 'blogPosts', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：打开过 / 收藏 / 用户与 AI 的帖子', note: '正文在用户点开 stub 时才生成并落进来；普通刷新不碰用户与 AI 帖' },
    { name: 'blogAuthors', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：站内作者与评论者', note: 'id = `${档案键}::${authorId}`；同名 = 同一个人，头像槽位确定性分配' },
    { name: 'blogComments', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：评论（外部帖的 + 用户自己帖子的）', note: '按 seq 排序；生成按 5 条一批，UI 折叠翻开不触发生成' },
    { name: 'blogHotSearch', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：热搜词条 + 各词条下的帖子 stub', note: 'id = 档案键；热度显示值由 JS 按小时窗演化，不回写' },
    { name: 'blogChats', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：站内闲聊消息', note: '刻意没有编辑 / 删除 / 重 roll 入口' },
    { name: 'blogDms', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：收到的私信', note: '点「收一批」才生成；演员 / 爱豆 / 电竞 provider 上线后会改变风向' },
    { name: 'blogEssays', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：随笔（全局档）', note: '纯本地，永不调 AI；day 字段是本地日期键，日历模式按它点黑点' },
    { name: 'blogOxygen', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：氧气值单条记录（全局档）', note: "id 永远是 'global'；含开关 / 数值 / 流水 / 黑匣子与恶作剧开关；电量绑定走 settings 的 batteryBridge" },
    { name: 'blogRoomItems', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：冥想空间的纸条与自我标签（全局档）', note: '位置 / 分组标签都在记录上；她的恶作剧小纸条 kind=xiaoting' },
    { name: 'blogGeometries', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：小听送的几何体（全局档）', note: '形状白名单解析；颜色由 JS 按小听颜色派生；房间满 24 个后最旧的 inDrawer=true' },
    { name: 'blogXiaoting', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：小听单条记录（全局档）', note: "id 永远是 'global'；名字 / 颜色 lightness / 画像 / 记忆碎片（上限 50）/ 出现与恶作剧频控" },
    { name: 'blogBlackbox', category: 'misc', owner: 'blog', declaredIn: 'app', keyPath: 'id', desc: '氧气：黑匣子条目（全局档）', note: '由 murmur 剥离 [黑匣子:] 写入，带真实模型名；可编辑可删除、无重 roll、永不回注 prompt' },

    // ── 追光（演员成长之路，actor-career）────────────────────────
    { name: 'actorProfiles', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：档案（一档案键一条）——首配 / 30 位 NPC 名册 / 奖项与节日定义 / 人设改写台账 / 主题', note: 'id = `${userId}::${worldId}`；名册由素材池确定性生成后固化，跨档共享' },
    { name: 'actorSaves', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：存档（档）——每档独立时钟 / 线级 / 九维属性 / 精力 / NPC 启用 / 公关护盾 / 荣誉 / 结局', note: '新开档时间回到原点；写进世界观时间轴的事件 id 存 worldTimelineIds，删档回收' },
    { name: 'actorEvents', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：事件日志（突发 / 交际 / 公告 / 快进区间），带触发概率快照', note: '掷签 seed = saveId+day+eventId，回放一致' },
    { name: 'actorTimeline', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：每档大事记（major 的会同步世界观时间轴）' },
    { name: 'actorProjects', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：剧本与项目——梦境编织改编快照 / 试镜记录（seed）/ 场次成色 / 片酬 / 上映热度', note: '片酬入账凭据 sourceType=actor-salary, sourceId=项目 id，幂等' },
    { name: 'actorSchedules', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：每档每天的课程与活动安排', note: 'id = `${saveId}::${day}`' },
    { name: 'actorNpcChats', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：NPC 聊天记录（每档隔离，按 seq 排）' },
    { name: 'actorStageCards', category: 'misc', owner: 'actor-career', declaredIn: 'app', keyPath: 'id', desc: '追光：阶段卡——人设某个阶段的封存快照（用户 / AI / NPC）', note: '跨档保留；重开新档属性重置但不删卡' },

    // ── 声浪（电竞论坛，esports-forum）────────────────────────────
    { name: 'esfProfiles', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：档案（一档案键一条）——首配 / 战队名与 AI 替换 / 赛事节日锚点 / 社媒偏好 / 论坛马甲与小号 / 人设改写台账 / 主题', note: 'id = `${userId}::${worldId}`；18 战队名册由档案键确定性生成，不落盘' },
    { name: 'esfSaves', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：存档（档）——每档独立时钟 / 七维属性 / 精力与饭点 / SAB 赛季状态（全部赛程与结果内嵌）/ 荣誉 / 已发薪期 / 排位概要', note: '新开档时间回原点、赛季从第一个启用赛事重开；世界观时间轴事件 id 存 worldTimelineIds，删档回收' },
    { name: 'esfPosts', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：论坛持久帖（用户匿名帖 / AI 帖 / 赛后楼 / 战绩围观楼）', note: '日常预置帖零 token 按天现拼不落盘；只有这些「有主的」帖子入表' },
    { name: 'esfComments', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：持久评论（AI 生成的 + 用户马甲回的）', note: '按 seq 排；可删除，没有重 roll；预置楼层确定性现拼不落盘' },
    { name: 'esfRatings', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：用户给选手打的分', note: 'id = `${saveId}::${playerId}`；粉丝均分由 JS 现算不落盘' },
    { name: 'esfEvents', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：事件日志（突发 / 节日 / 赛季公告），带触发概率快照', note: '掷签 seed = saveId+day+eventId，回放一致' },
    { name: 'esfTimeline', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：每档生涯大事记（major 的同步世界观时间轴）' },
    { name: 'esfStageCards', category: 'misc', owner: 'esports-forum', declaredIn: 'app', keyPath: 'id', desc: '声浪：阶段卡——人设某个阶段的封存快照', note: '跨档保留；重开新档属性重置但不删卡' },

    // ── 赛点（电竞游戏，esports-game）────────────────────────────
    // 五张表全部挂 saveId（声浪的档 id）：游戏数据跟着档走，声浪删档后可清孤儿。
    { name: 'esgStates', category: 'misc', owner: 'esports-game', declaredIn: 'app', keyPath: 'id', desc: '赛点：一档一条——巅峰分 / 英雄熟练度与本命 / 每日局数 / 训练赛标记 / 待同步声浪队列', note: 'id 就是声浪的 saveId；巅峰分起点由首配起点定位决定' },
    { name: 'esgSessions', category: 'misc', owner: 'esports-game', declaredIn: 'app', keyPath: 'id', desc: '赛点：排位场次（一次 N 局的概要：胜负 / 巅峰分变化 / 同行者）', note: '概要幂等写回声浪 recordRankSession，论坛围观楼与 murmur 同游卡都吃它' },
    { name: 'esgMatches', category: 'misc', owner: 'esports-game', declaredIn: 'app', keyPath: 'id', desc: '赛点：单局明细（seed / KDA / 路人队友 / 懒生成的云端文字回放）', note: 'replay 字段在用户点「查看对局详情」时才由 AI 生成' },
    { name: 'esgRelations', category: 'misc', owner: 'esports-game', declaredIn: 'app', keyPath: 'id', desc: '赛点：亲密关系（互关 / 亲密值日增益上限 / 情侣标）', note: 'id = `${saveId}::${targetId}`；情侣标只能和 AI 角色绑，亲密 60 起' },
    { name: 'esgChats', category: 'misc', owner: 'esports-game', declaredIn: 'app', keyPath: 'id', desc: '赛点：战队群与教练私聊（教练每日安排零 token，回话与复盘才调 AI）', note: '按 seq 排；刻意没有编辑 / 删除 / 重 roll 入口' },

    // ── 点灯（学习，starlit）──────────────────────────────────────
    // 八张表。除 slProfiles 外全部带 profileKey；但和购物/求职不同，
    // 这里的档案键是 `${userId}::${worldId|solo}` —— 点灯不要求绑世界观，
    // 没绑世界的用户走 solo 档，照常能学。
    { name: 'slProfiles', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：一档的外观 / 默认老师来源 / 弹幕、灵动岛、小电视三套悬浮播放设置', note: 'id 就是档案键本身' },
    { name: 'slTopics', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：学习主题（模式 / 目标语言或技术栈 / 终点 / 水平侧写 / 推理墙视口）', note: '一个主题 = 一面推理墙 = 一个卡片库；learnerProfile 每次结课覆盖重写，profileVersion 记版本' },
    { name: 'slLessons', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：课程（序号 / 目标 / 状态 / 总结 / 用户笔记 / 反转课堂结果）', note: 'objectives[].from 区分是规划时定的、课上 AI 加的、还是错题本补课' },
    { name: 'slMessages', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：上课与反转课堂的消息（scene 字段区分两个会话）', note: '按 seq 排序而不是 createdAt —— 同一毫秒插两条时时间戳会撞；gloss 是语言模式贴在气泡旁的描边中文' },
    { name: 'slCards', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：卡片库（概念 / 词卡 / 代码卡 / 帖子 / 小测 / 笔记 / 卡住点）+ 推理墙坐标与卡片堆', note: '**卡片的唯一真相**，可跨课复用：usedInLessons 记它被哪几节课用过；edited=true 之后 AI 不再覆盖' },
    { name: 'slLinks', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：卡片之间的连线（关系类型 / 标签 / 弯曲量 / 谁连的）', note: '单独成表是因为拖一次卡片要重算路径，塞进卡片里会连带重写整张卡' },
    { name: 'slDictEntries', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：知识点词典 + 间隔重复调度字段（step / dueAt / reps / lapses / bucket）', note: '弹幕、灵动岛、小电视三种悬浮播放都从这张表抽条目；bucket 决定出现频率' },
    { name: 'slStuckPoints', category: 'misc', owner: 'starlit', declaredIn: 'app', keyPath: 'id', desc: '点灯：错题本（卡在哪 / AI 判断缺什么前置 / 补课安排到哪节）', note: '知识不是线性的 —— 卡住多半是缺前置，AI 会把补课挂到后面某节课的目标里' },

    // ── 气泡机 ─────────────────────────────────────────────────
    { name: 'bbLibrary', category: 'creation', owner: 'bubble-maker', declaredIn: 'app', keyPath: 'id', desc: '气泡机：设置 / 界面配色 / SVG 形状库', note: "单例表，id 永远是 'root'；SVG 在写入这一层就消过毒" },
    { name: 'bbBubbles', category: 'creation', owner: 'bubble-maker', declaredIn: 'app', keyPath: 'id', desc: '气泡机：一个气泡预设（底色 / 圆角 / 描边 / 阴影 / 尾巴）', note: '情景剧场通过 services.getBubble 按 id 取，不直接读这张表' },

    // ── 情景剧场 ───────────────────────────────────────────────
    // 消息单独一张表：塞在存档记录里的话，每发一条都要重新序列化前面全部。
    { name: 'spLibrary', category: 'creation', owner: 'scene-play', declaredIn: 'app', keyPath: 'id', desc: '情景剧场：设置 / 配色 / 分类 / 外观主题 / 正则库 / 文案库', note: "单例表，id 永远是 'root'" },
    { name: 'spScenes', category: 'creation', owner: 'scene-play', declaredIn: 'app', keyPath: 'id', desc: '情景剧场：一个情景的设定（不含消息）', indexes: ['categoryId'] },
    { name: 'spSaves', category: 'creation', owner: 'scene-play', declaredIn: 'app', keyPath: 'id', desc: '情景剧场：存档元信息（不含消息）', indexes: ['sceneId'], note: '一个情景下可以有很多档，另存为 = 从当前进度分叉' },
    { name: 'spMessages', category: 'creation', owner: 'scene-play', declaredIn: 'app', keyPath: 'id', desc: '情景剧场：单条消息', indexes: ['saveId'], note: '按 seq 排序而不是 createdAt —— 同一毫秒插两条时时间戳会撞' },

    // ── 设备 ───────────────────────────────────────────────────
    { name: 'deviceSettings', category: 'device', owner: 'settings', declaredIn: 'base+app', keyPath: 'key', desc: '设备级设置：手机壳、电池、状态栏' },
    { name: 'AppSettings', category: 'device', owner: 'framework', declaredIn: 'base', keyPath: 'key', desc: '通用键值设置' },

    // ── 其他 ───────────────────────────────────────────────────
    { name: 'weatherCities', category: 'misc', owner: 'weather-app', declaredIn: 'base+app', keyPath: 'id', desc: '天气 App 的城市列表与天气缓存' },

    // ── 遗留 ───────────────────────────────────────────────────
    { name: 'Userinfo', category: 'legacy', owner: 'framework', declaredIn: 'base', keyPath: 'userId', desc: '早期用户表', note: '已被 sdkUsers 取代' },
    { name: 'charInfo', category: 'legacy', owner: 'framework', declaredIn: 'base', keyPath: 'charId', desc: '早期角色表', note: '已被 sdkAiPersons 取代' },
    { name: 'worldInfo', category: 'legacy', owner: 'framework', declaredIn: 'base', keyPath: 'worldId', desc: '早期世界观表', note: '已被 sdkWorlds 取代' },
    { name: 'apiInfo', category: 'legacy', owner: 'framework', declaredIn: 'base', keyPath: 'apiId', desc: '早期 API 表', note: '已被 apiKeys 取代' },
];

const STORE_INDEX = new Map(DB_STORES.map((s) => [s.name, s]));

const PLUGIN_META_KEY = 'xiaoting_plugins_meta';

function collectRegisteredApps() {
    const apps = [];
    const seen = new Set();
    const push = (app) => {
        if (!app?.id || seen.has(app.id)) return;
        seen.add(app.id);
        apps.push(app);
    };
    if (typeof window === 'undefined') return apps;
    const ref = window.__phoneAppsRef?.value;
    if (Array.isArray(ref)) ref.forEach(push);
    const reg = window.externalAppRegistry;
    if (reg && Array.isArray(reg.apps)) reg.apps.forEach(push);
    return apps;
}

/**
 * 静态目录里没有、但运行时 App / 已装插件声明了的表。
 * 上传的插件不可能改 db-catalog.js，不动态收进来的话，
 * nook 数据库页看不见、审计也会一直报「还没登记」。
 */
export function listExtraStores() {
    const known = new Set(DB_STORES.map((s) => s.name));
    const extras = [];
    const add = (entry) => {
        if (!entry?.name || known.has(entry.name)) return;
        known.add(entry.name);
        extras.push(entry);
    };

    for (const app of collectRegisteredApps()) {
        for (const store of (app.stores || [])) {
            add({
                name: store.name,
                category: 'plugin',
                owner: app.id,
                declaredIn: 'plugin',
                keyPath: store.keyPath || 'id',
                desc: `${app.name || app.id} 的数据表`,
                note: '插件安装时由 registerPhoneAppAsync 建表，不写进静态目录',
            });
        }
    }

    if (typeof window !== 'undefined') {
        try {
            const raw = JSON.parse(localStorage.getItem(PLUGIN_META_KEY) || '{}');
            for (const plugin of Object.values(raw || {})) {
                for (const store of (plugin.stores || [])) {
                    add({
                        name: store.name,
                        category: 'plugin',
                        owner: plugin.appId,
                        declaredIn: 'plugin',
                        keyPath: store.keyPath || 'id',
                        desc: `${plugin.name || plugin.appId} 的数据表`,
                        note: '来自已安装插件的声明',
                    });
                }
            }
        } catch (_) { /* noop */ }
    }

    return extras;
}

export function getStoreInfo(name) {
    const key = String(name || '');
    return STORE_INDEX.get(key) || listExtraStores().find((s) => s.name === key) || null;
}

/** 按分类分组的目录，给 UI 直接遍历。插件表每次现查，不能模块加载时缓存。 */
export function listCatalog() {
    const extras = listExtraStores();
    const cats = DB_CATEGORIES.map((cat) => ({
        ...cat,
        stores: DB_STORES.filter((s) => s.category === cat.id),
    }));
    if (extras.length) {
        cats.push({
            id: 'plugin',
            label: '已安装插件',
            desc: '通过软件管理装进来的 App 自己建的表',
            stores: extras,
        });
    }
    return cats.filter((cat) => cat.stores.length > 0);
}

/** 某个 App 拥有哪些表 */
export function listStoresByOwner(appId) {
    return [
        ...DB_STORES.filter((s) => s.owner === appId),
        ...listExtraStores().filter((s) => s.owner === appId),
    ];
}

/**
 * 三方对账：实际数据库 / App 声明 / 本目录。
 *
 * 三者应该完全一致。不一致的三种情况分别对应三类真实 bug：
 *
 *   missingInDb    目录/声明里有、数据库里没有
 *                  → 多半是「声明了 stores 却走同步注册」，表压根没建，
 *                    写入静默失败（表现：保存成功但刷新就没了）
 *   undeclared     数据库里有、没有任何 App 声明
 *                  → 要么是卸载的 App 留下的孤儿表，要么是代码里直接
 *                    `db.getAll('xxx')` 硬用的表
 *   uncatalogued   数据库/声明里有、本目录没登记
 *                  → 目录该更新了。留着不管，这份说明书就会重新变成废纸
 *
 * @returns {Promise<{ok:boolean, actual:string[], declared:string[], missingInDb:string[], undeclared:string[], uncatalogued:string[], counts:Record<string,number>}>}
 */
export async function auditStores(options = {}) {
    const db = typeof window !== 'undefined' ? window.myDb : null;
    const registry = typeof window !== 'undefined' ? window.__phoneAppsRef?.value : null;

    let actual = [];
    if (db) {
        if (typeof db.getStoreNames === 'function') actual = db.getStoreNames() || [];
        else if (Array.isArray(db.stores)) actual = db.stores.map((s) => s.name);
    }
    actual = [...new Set(actual.map(String))].sort();

    const extras = listExtraStores();
    const declaredSet = new Set([
        ...DB_STORES.map((s) => s.name),
        ...extras.map((s) => s.name),
    ]);
    const appDeclared = new Set();
    for (const app of (Array.isArray(registry) ? registry : [])) {
        for (const store of (app?.stores || [])) {
            if (store?.name) appDeclared.add(String(store.name));
        }
    }

    const actualSet = new Set(actual);
    const missingInDb = [...declaredSet].filter((n) => !actualSet.has(n)).sort();
    const undeclared = actual.filter((n) => !appDeclared.has(n) && !declaredSet.has(n)).sort();
    const uncatalogued = [...new Set([...actual, ...appDeclared])].filter((n) => !declaredSet.has(n)).sort();

    const counts = {};
    if (db && options.withCounts !== false) {
        for (const name of actual) {
            try {
                const rows = await db.getAll(name);
                counts[name] = Array.isArray(rows) ? rows.length : 0;
            } catch (_) {
                counts[name] = -1; // -1 = 读不出来（表存在但访问出错）
            }
        }
    }

    return {
        ok: missingInDb.length === 0 && uncatalogued.length === 0,
        actual,
        declared: [...declaredSet].sort(),
        appDeclared: [...appDeclared].sort(),
        missingInDb,
        undeclared,
        uncatalogued,
        counts,
    };
}

/**
 * localStorage 的键也登记一份。
 *
 * IndexedDB 至少能枚举，localStorage 是纯字符串键，
 * 不写下来就只能靠全局搜索 `localStorage.getItem` 才知道有哪些。
 */
export const LOCAL_STORAGE_KEYS = [
    { key: 'xiaoting_plugins_meta', owner: 'framework', desc: '用户装过的插件 App：元数据 + 完整源码', note: '插件源码整段存在这里，装多了会顶到 localStorage 配额' },
    { key: 'xiaoting::app-presence-prefs-v1', owner: 'framework', desc: '灵动岛 / 小组件的用户开关与自定义 CSS', note: '用 localStorage 而不是 IndexedDB：island.show() 是同步的，拦截判断来不及异步读盘' },
    { key: 'xiaoting::app-maker-draft-v1', owner: 'app-maker', desc: 'App 制作问卷的答案草稿' },
    { key: 'xiaoting::shop-last-profile-v1', owner: 'shop', desc: '四叶草上次用的档案键', note: '只是启动加速用的提示，真数据在 shopProfiles；这个键丢了不影响任何东西' },
    { key: 'xiaoting::job-last-profile-v1', owner: 'job', desc: '灯塔上次用的档案键', note: '同上，只是启动加速用的提示，丢了不影响任何东西' },
    { key: 'xiaoting::oxygen-shutdown-pending', owner: 'blog', desc: '氧气归零标记：{at, count}，下次刷新触发关机彩蛋', note: '只在完整播放结束时清除；关闭氧气系统也会清。必须是 localStorage —— 黑屏要在框架起来之前同步判断' },
    { key: 'xiaoting::oxygen-shutdown-notes', owner: 'blog', desc: '关机输入框的暂存，下次进氧气迁入小听的记忆后清空' },
    { key: 'xiaoting::oxygen-blackbox-enabled', owner: 'blog', desc: '黑匣子开关镜像（真相在 blogOxygen 表）', note: 'chat 剥离 [黑匣子:] 时要同步快查，等不了 IndexedDB' },
    { key: 'xiaoting::esports-setup-draft-v1', owner: 'esports-forum', desc: '声浪首配向导的草稿位', note: '完成首配后清除；丢了只是重填表单' },
    { key: 'xiaoting::esports-game-theme-v1', owner: 'esports-game', desc: '赛点的主题选择与自定义色', note: '设备级外观偏好，跟档无关，所以不进 IndexedDB' },
];

if (typeof window !== 'undefined') {
    window.__dbCatalog = { DB_STORES, DB_CATEGORIES, LOCAL_STORAGE_KEYS, listCatalog, getStoreInfo, listStoresByOwner, listExtraStores, auditStores };
}
