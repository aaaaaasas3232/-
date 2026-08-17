/**
 * App 制作 · 常量与选项表
 *
 * 这里的每一张表都对应问卷里的一道题。之所以集中放在一个文件：
 * 同一份选项要被**三处**消费 —— 问卷 UI（画选项）、代码生成器（生成真代码）、
 * 提示词生成器（写给 AI 看的描述）。分散写就必然出现「问卷里能选、
 * 生成出来没有」这种对不上的情况。
 *
 * ★ 命名约定：每个选项都有 value / title / desc 三件套。
 *   value 进 blueprint 和代码；title 给用户看；desc 是「这是什么」的一句话解释。
 *   凡是用户可能不懂的词，desc 必须用大白话，不要用术语解释术语。
 */

// ===========================================================================
// 视觉风格 —— 12 套配色
// ===========================================================================

export const DESIGN_STYLES = [
    { value: 'ios-blue', title: '经典蓝', desc: 'iOS 标准', bg: '#F2F2F7', card: '#FFFFFF', prim: '#007AFF', text: '#0f172a', iconBg: 'linear-gradient(145deg, #5AC8FA, #007AFF)', statusBar: '#1c1c1e' },
    { value: 'dopamine', title: '多巴胺', desc: '高饱和快乐色', bg: '#FFF0F5', card: '#FFFFFF', prim: '#FF69B4', text: '#3d1f2e', iconBg: 'linear-gradient(135deg, #FF6B9D, #FFD93D)', statusBar: '#7a2148' },
    { value: 'cyberpunk', title: '赛博朋克', desc: '黑底霓虹', bg: '#0A0A0F', card: '#1C1C2E', prim: '#00FF9D', text: '#e8fff6', iconBg: 'linear-gradient(135deg, #00FF9D, #00B8FF)', statusBar: '#e8fff6', dark: true },
    { value: 'glass', title: '毛玻璃', desc: '极致透明', bg: 'linear-gradient(135deg,#a8edea,#fed6e3)', card: 'rgba(255,255,255,0.42)', prim: '#5e60ce', text: '#2b2d42', iconBg: 'linear-gradient(135deg, #a8edea, #fed6e3)', statusBar: '#2b2d42' },
    { value: 'morandi', title: '莫兰迪', desc: '高级灰调', bg: '#E0E5DF', card: '#F0F2F0', prim: '#76877D', text: '#39423c', iconBg: 'linear-gradient(145deg, #A8B5A0, #76877D)', statusBar: '#39423c' },
    { value: 'warm-sunset', title: '暖阳落日', desc: '温暖橙粉', bg: 'linear-gradient(180deg,#FFF5EB,#FFE4D6)', card: '#FFFFFF', prim: '#FF6B35', text: '#4a2c1a', iconBg: 'linear-gradient(135deg, #FFB75E, #ED8F03)', statusBar: '#4a2c1a' },
    { value: 'ocean-deep', title: '深海蓝', desc: '沉稳深蓝', bg: '#0B1426', card: '#132040', prim: '#4FC3F7', text: '#e3f2fd', iconBg: 'linear-gradient(135deg, #4FC3F7, #1976D2)', statusBar: '#e3f2fd', dark: true },
    { value: 'sakura', title: '樱花粉', desc: '柔和少女', bg: '#FFF0F3', card: '#FFFFFF', prim: '#E91E8C', text: '#4a1f37', iconBg: 'linear-gradient(135deg, #FFB6C1, #E91E8C)', statusBar: '#4a1f37' },
    { value: 'neumorphism', title: '新拟态', desc: '柔和凹凸', bg: '#E0E5EC', card: '#E0E5EC', prim: '#6C63FF', text: '#31344b', iconBg: 'linear-gradient(145deg, #B8BCC8, #6C63FF)', statusBar: '#31344b' },
    { value: 'flat-minimal', title: '扁平极简', desc: '无阴影纯色', bg: '#FFFFFF', card: '#F5F5F5', prim: '#333333', text: '#111111', iconBg: 'linear-gradient(145deg, #F5F5F5, #333333)', statusBar: '#111111' },
    { value: 'material-you', title: 'Material You', desc: '动态取色', bg: '#FFFBFE', card: '#FEF7FF', prim: '#6750A4', text: '#1d1b20', iconBg: 'linear-gradient(135deg, #D0BCFF, #6750A4)', statusBar: '#1d1b20' },
    { value: 'retro-pixel', title: '像素复古', desc: '8-bit 怀旧', bg: '#2B2B2B', card: '#3C3C3C', prim: '#FFD700', text: '#f5f5f5', iconBg: 'linear-gradient(135deg, #FFD700, #FF6F00)', statusBar: '#f5f5f5', dark: true },
];

export const STYLE_MAP = Object.fromEntries(DESIGN_STYLES.map((s) => [s.value, s]));

export function getStyle(value) {
    return STYLE_MAP[value] || DESIGN_STYLES[0];
}

// ===========================================================================
// 渲染模式 —— 用户口中的「三种类型」
// ===========================================================================

export const RENDER_MODES = [
    {
        value: 'template',
        title: '模板模式',
        sub: '拼字符串',
        desc: '每次改数据，整页 HTML 重新拼一遍。写起来最简单，适合内容为主、交互不多的 App。',
        caveat: '缺点很具体：输入框每敲一个字整块 DOM 就会重建，光标会跳走。所以有大量文字输入的 App 别选它。',
        good: ['清单', '设置页', '资讯流', '详情展示'],
    },
    {
        value: 'hybrid',
        title: '混合模式',
        sub: '字符串 + 组件',
        desc: '大部分还是拼字符串，但可以在里面插入真正的 Vue 组件（开关、滑块这类）。',
        caveat: '两套心智模型混着用，出问题时不容易判断是哪一边的。除非确实需要个别交互组件，否则不如直接上 Vue。',
        good: ['带几个开关的设置页', '表单为主的页面'],
    },
    {
        value: 'vue',
        title: 'Vue 模式',
        sub: '完整组件',
        desc: '写标准 Vue 组件。输入框不会掉焦点，动画和实时更新都顺，是复杂 App 的唯一合理选择。',
        caveat: '框架不会自动帮你调 hydrate，要自己在根组件 mounted 里启动一次。',
        good: ['编辑器', '聊天', '播放器', '任何有输入框的 App'],
    },
];

// ===========================================================================
// 顶栏
// ===========================================================================

export const TOPBAR_TYPES = [
    { value: 'none', title: '不要顶栏', desc: '页面自己画，或者干脆没有', preview: 'none' },
    { value: 'standard', title: '标准', desc: '居中标题 + 副标题', preview: 'standard' },
    { value: 'title-only', title: '仅标题', desc: '只有一行标题，最干净', preview: 'title' },
    { value: 'large-title', title: '大标题', desc: 'iOS 那种左对齐大字标题', preview: 'large' },
    { value: 'search', title: '搜索栏', desc: '标题位置直接放搜索框', preview: 'search' },
    { value: 'segmented', title: '分段切换', desc: '顶部一排横向 tab', preview: 'segmented' },
    { value: 'buttons-only', title: '纯按钮组', desc: '不放标题，一排功能按钮平分整条', preview: 'buttons' },
];

/**
 * 纯按钮组能放的按钮。比右上角那三个多一些 —— 这个类型的整条顶栏都归按钮，
 * 放得下 5 个带文字的。
 */
export const TOPBAR_BUTTON_ACTIONS = [
    { value: 'add', title: '新建', desc: '＋' },
    { value: 'search', title: '搜索', desc: '放大镜' },
    { value: 'filter', title: '筛选', desc: '漏斗' },
    { value: 'sort', title: '排序', desc: '升降箭头' },
    { value: 'star', title: '收藏', desc: '星星' },
    { value: 'refresh', title: '刷新', desc: '循环箭头' },
    { value: 'export', title: '导出', desc: '向上箭头' },
    { value: 'settings', title: '设置', desc: '齿轮' },
];

export const TOPBAR_LEFT_ACTIONS = [
    { value: 'none', title: '不放', desc: '' },
    { value: 'back', title: '返回', desc: '‹ 箭头' },
    { value: 'menu', title: '菜单', desc: '三条杠' },
    { value: 'avatar', title: '头像', desc: '圆形头像入口' },
    { value: 'close', title: '关闭', desc: '× 号' },
];

export const TOPBAR_RIGHT_ACTIONS = [
    { value: 'search', title: '搜索', desc: '放大镜' },
    { value: 'add', title: '新建', desc: '＋' },
    { value: 'more', title: '更多', desc: '···' },
    { value: 'filter', title: '筛选', desc: '漏斗' },
    { value: 'settings', title: '设置', desc: '齿轮' },
    { value: 'done', title: '完成', desc: '文字按钮' },
];

// ===========================================================================
// 底栏
// ===========================================================================

export const TABBAR_TYPES = [
    { value: 'none', title: '不要底栏', desc: '单页 App，或者自己画' },
    { value: 'default', title: '标准 Tab', desc: '毛玻璃 + 图标 + 文字' },
    { value: 'minimal', title: '极简', desc: '只有图标，没有文字' },
    { value: 'indicator', title: '滑动指示器', desc: '选中项下面一条小横线滑动' },
    { value: 'liquid', title: '液球', desc: 'App Store 那种弹性动画' },
    { value: 'wave', title: '波浪', desc: '音乐 App 那种，背景有波浪' },
];

export const FAB_POSITIONS = [
    { value: 'none', title: '不要', desc: '' },
    { value: 'bottom-right', title: '右下角', desc: '最常见，右手拇指够得到' },
    { value: 'bottom-center', title: '底部居中', desc: '会压在 tab 栏上方' },
    { value: 'bottom-left', title: '左下角', desc: '左手用户友好' },
];

// ===========================================================================
// 布局与密度
// ===========================================================================

export const PAGE_LAYOUTS = [
    { value: 'column', title: '单列流', desc: '一张接一张竖着排', hint: '最稳妥的选择。信息流、清单、详情都用它。' },
    { value: 'twoColumn', title: '双列网格', desc: '两列等宽', hint: '图多的时候用。窄屏会自动变成一列。' },
    { value: 'grid', title: '自适应网格', desc: '按最小宽度自动决定列数', hint: '功能入口、图标格。' },
    { value: 'masonry', title: '瀑布流', desc: '等宽不等高', hint: '注意：顺序是按列走的（1、2 在左列），要求严格按时间倒序的内容别用。' },
    { value: 'carousel', title: '横向滑动', desc: '一行横着滑', hint: '一般作为某一段，不适合当整页。' },
    { value: 'groupedList', title: '分组列表', desc: 'iOS 设置页那种圆角分组', hint: '设置、偏好、账户。' },
    { value: 'split', title: '左右分栏', desc: '左侧固定分类 + 右侧内容', hint: '手机上偏窄，侧栏别超过 110px。' },
];

export const DENSITY_OPTIONS = [
    { value: 'tight', title: '紧凑', desc: '间距 8px · 一屏塞得下更多', pad: 8, gap: 8 },
    { value: 'snug', title: '偏紧', desc: '间距 12px', pad: 12, gap: 10 },
    { value: 'normal', title: '标准', desc: '间距 16px · 推荐', pad: 16, gap: 12 },
    { value: 'relaxed', title: '宽松', desc: '间距 20px · 呼吸感强', pad: 20, gap: 16 },
    { value: 'loose', title: '很宽松', desc: '间距 24px · 内容少时好看', pad: 24, gap: 20 },
];

export const RADIUS_OPTIONS = [
    { value: 'none', title: '直角', desc: '0px' },
    { value: 'sm', title: '小圆角', desc: '8px' },
    { value: 'md', title: '中圆角', desc: '14px · 推荐' },
    { value: 'lg', title: '大圆角', desc: '20px' },
    { value: 'xl', title: '超大圆角', desc: '28px' },
];

export const ELEVATION_OPTIONS = [
    { value: 'none', title: '无阴影', desc: '扁平' },
    { value: 'sm', title: '轻阴影', desc: '几乎看不出的一层 · 推荐' },
    { value: 'md', title: '中阴影', desc: '卡片明显浮起' },
    { value: 'lg', title: '重阴影', desc: '强立体感' },
];

// ===========================================================================
// 卡片与信息组
// ===========================================================================

export const CARD_TYPES = [
    { value: 'info', title: '信息卡', desc: '图标 + 标题 + 正文', use: '什么都能装' },
    { value: 'row', title: '列表行', desc: '一行一条，右边带箭头', use: '清单、设置' },
    { value: 'stat', title: '数据卡', desc: '一个大数字', use: '统计、概览' },
    { value: 'media', title: '媒体卡', desc: '上图下字', use: '图集、封面' },
    { value: 'progress', title: '进度卡', desc: '带进度条', use: '目标、任务' },
    { value: 'profile', title: '头像卡', desc: '头像 + 名字', use: '联系人、成员' },
    { value: 'timeline', title: '时间轴', desc: '竖线 + 节点', use: '历史、日志' },
    { value: 'keyValue', title: '键值表', desc: '左右两列对齐', use: '详情、确认' },
    { value: 'bars', title: '柱状图卡', desc: '一排柱子', use: '趋势对比' },
    { value: 'banner', title: '横幅', desc: '一句话 + 一个按钮', use: '引导、空首屏' },
    { value: 'tags', title: '标签行', desc: '一排 pill', use: '筛选、分类' },
    { value: 'product', title: '商品卡', desc: '图 + 标题 + 价格 + 按钮', use: '购物列表' },
    { value: 'order', title: '订单卡', desc: '订单状态 + 时间 + 金额', use: '订单列表' },
    { value: 'job', title: '职位卡', desc: '公司 + 职位 + 薪资 + 时间', use: '求职列表' },
];

/** 卡片上能放哪些信息 —— 「卡片的具体信息组」那道题 */
export const CARD_FIELDS = [
    { value: 'title', title: '标题', desc: '主文字，必有' },
    { value: 'subtitle', title: '副标题', desc: '标题下一行小字' },
    { value: 'body', title: '正文摘要', desc: '两三行描述' },
    { value: 'icon', title: '图标', desc: '左侧小图标' },
    { value: 'image', title: '配图', desc: '缩略图或封面' },
    { value: 'time', title: '时间', desc: '创建 / 更新时间' },
    { value: 'badge', title: '角标', desc: '状态、数量、NEW' },
    { value: 'tags', title: '标签', desc: '一排小 pill' },
    { value: 'number', title: '数值', desc: '计数、金额、进度' },
    { value: 'avatar', title: '头像', desc: '人物头像' },
    { value: 'actions', title: '操作按钮', desc: '卡片右侧 / 底部的按钮' },
    { value: 'chevron', title: '进入箭头', desc: '右侧 ›，表示可点进详情' },
];

// ===========================================================================
// 子页面模板 —— 「每个主页面绑定的子页面」那道题
// ===========================================================================

export const SUBPAGE_TEMPLATES = [
    { value: 'detail', title: '详情页', desc: '点一条进去看全部内容', common: true },
    { value: 'edit', title: '编辑页', desc: '新建 / 修改一条记录', common: true },
    { value: 'search', title: '搜索结果页', desc: '输关键词后的结果列表' },
    { value: 'filter', title: '筛选页', desc: '按条件挑选' },
    { value: 'settings', title: '设置页', desc: '这个模块自己的偏好' },
    { value: 'empty-guide', title: '引导页', desc: '第一次进来时的说明' },
    { value: 'preview', title: '预览页', desc: '看效果，不能改' },
    { value: 'history', title: '历史记录页', desc: '过往记录列表' },
];

// ===========================================================================
// 白膜组件 —— 直接映射到 src/core/presets
// ===========================================================================

export const MODAL_CHOICES = [
    { value: 'confirm', title: '确认框', desc: '确定 / 取消。删除这类不可逆操作必备。' },
    { value: 'prompt', title: '输入框', desc: '弹出来让用户填一行字，比如重命名。' },
    { value: 'form', title: '表单弹窗', desc: '一次填好几个字段。新建条目常用。' },
    { value: 'actionSheet', title: '底部动作面板', desc: '从底部升起一列操作，长按菜单那种。' },
    { value: 'picker', title: '单选列表', desc: '一组选项挑一个。' },
    { value: 'sheet', title: '自定义抽屉', desc: '底部升起，内容自己填。放长表单用。' },
    { value: 'toast', title: '轻提示', desc: '几秒后自己消失，不打断操作。' },
];

export const ISLAND_CHOICES = [
    { value: 'toast', title: '操作反馈', desc: '保存成功这类短提示', sustained: false },
    { value: 'message', title: '新消息', desc: '收到消息 / 通知时', sustained: false },
    { value: 'progress', title: '进行中的任务', desc: '导出、上传，带进度条', sustained: true },
    { value: 'timer', title: '计时中', desc: '专注、录音、倒计时', sustained: true },
    { value: 'status', title: '实时状态', desc: '连接中、同步中', sustained: true },
    { value: 'nowPlaying', title: '正在播放', desc: '音频 / 视频播放中', sustained: true },
];

export const WIDGET_CHOICES = [
    { value: 'stat', title: '数据', desc: '一个大数字', sizes: ['S', 'M', 'L'] },
    { value: 'ring', title: '环形进度', desc: '进度环 + 百分比', sizes: ['S', 'M'] },
    { value: 'list', title: '列表', desc: '最近 2–4 条', sizes: ['M', 'L'] },
    { value: 'actions', title: '快捷入口', desc: '2–4 个按钮', sizes: ['M', 'L'] },
    { value: 'chart', title: '趋势图', desc: '一排小柱子', sizes: ['M', 'L'] },
    { value: 'text', title: '一句话', desc: '一段短文字', sizes: ['M', 'L'] },
];

export const WIDGET_SIZES = [
    { value: 'S', title: '小', desc: '2×1 · 只放一个数' },
    { value: 'M', title: '中', desc: '2×2 · 数字 + 说明' },
    { value: 'L', title: '大', desc: '4×2 · 列表或图表' },
];

// ===========================================================================
// 能力
// ===========================================================================

export const CAPABILITIES = [
    { value: 'db', title: '本地存储', desc: '关掉再打开数据还在', impact: '会生成 stores 声明 + 读写封装' },
    { value: 'ai', title: 'AI 对话', desc: '调用你在设置里配的 API', impact: '会生成 callAi 方法 + API 选择兜底' },
    // 「按世界观现生成内容」和普通的「AI 对话」是两件事：
    // 后者是「我说一句它答一句」，前者是「这个 App 里的每一件东西都由 AI 按世界观造出来」。
    // 后者做错了顶多聊不起来，前者做错了整个 App 会和世界观完全没关系 —— 而这一点
    // 在开发机上很难发现，因为随便什么内容看着都像那么回事。
    {
        value: 'worldContent',
        title: '按世界观生成内容',
        desc: 'App 里的东西不是预置的，是按当前世界观现问 AI 造出来的',
        impact: '会生成首次配置流程 + 档案分档 + 列表/详情两段式生成',
    },
    { value: 'search', title: '搜索', desc: '在自己的数据里搜' },
    { value: 'filter', title: '筛选排序', desc: '按条件过滤、换排序' },
    { value: 'image', title: '图片上传', desc: '从相册选图，存成 dataUrl' },
    { value: 'share', title: '分享', desc: '把内容发给别的 App' },
    { value: 'favorite', title: '收藏', desc: '标记 / 取消标记' },
    { value: 'darkMode', title: '深浅色切换', desc: '两套配色' },
    { value: 'gesture', title: '手势', desc: '左滑露出操作按钮' },
    { value: 'pullRefresh', title: '下拉刷新', desc: '列表顶部下拉' },
    { value: 'onboarding', title: '首次引导', desc: '第一次打开时的说明流程' },
    { value: 'export', title: '导入导出', desc: '数据存成文件 / 从文件读回' },
    // ★ v0.88 购物相关能力
    {
        value: 'shopping',
        title: '购物功能',
        desc: '商品展示 + 购物车 + 结算流程',
        impact: '会生成商品卡、购物车状态管理、订单生成逻辑',
    },
    {
        value: 'payment',
        title: '支付系统',
        desc: '模拟支付流程、资金变动记录',
        impact: '会生成支付弹窗、交易流水、资金链映射到世界观货币',
    },
    // ★ v0.88 求职相关能力
    {
        value: 'job',
        title: '求职功能',
        desc: '职位展示 + 简历投递 + 申请状态跟踪',
        impact: '会生成职位卡、投递记录、申请进度管理',
    },
    {
        value: 'resume',
        title: '简历管理',
        desc: '用户简历的增删改查',
        impact: '会生成简历编辑页、数据存储',
    },
    {
        value: 'gameGomoku',
        title: '五子棋',
        desc: '用户对战 AI，走棋走 toolkit / window.__apiSdk',
        impact: '会生成棋盘、胜负判定、AI 落子调用',
    },
    {
        value: 'gameSnake',
        title: '贪吃蛇',
        desc: '纯本地小游戏，不连 AI',
        impact: '会生成格子、方向、分数、暂停/重开',
    },
    {
        value: 'gameArena',
        title: '跨时空回合制',
        desc: '用户 + 最多 3 个 AI，各用自己的 API Key',
        impact: '会生成座位、回合、各 AI 独立 executeApiRequest',
    },
    // ★ v0.90 世界观模拟系统（「追光」演员 App 落地后抽出来的整套地基）。
    // 这些能力共同构成「世界观预设游戏 App」：钱是真的、时间会走、
    // 事件有概率、可以存档重来。每一项都对应 src/core 或参考实现里的真模块，
    // 生成器不再让 AI 凭空发明轮子。
    {
        value: 'worldAsset',
        title: '真实资产联动',
        desc: '收入支出走全系统同一本账（和聊天红包、四叶草一个钱包）',
        impact: '会生成 asset-ledger 接入：幂等入账 / 扣款 / 退款，sourceType+sourceId 凭据',
    },
    {
        value: 'worldTime',
        title: '世界时间系统',
        desc: '世界观纪时映射 + 每档独立时间轴：调早中晚、快进 N 天、24 点问跨日',
        impact: '会生成每档虚拟时钟（anchorMs/day/minute）+ chronology 映射 + 快进结算',
    },
    {
        value: 'worldGeo',
        title: '世界地点接入',
        desc: '读世界观的地点场所，新地点由用户确认后幂等登记',
        impact: '会生成 places/locations 读取 + registerGeoCandidate 注册流程',
    },
    {
        value: 'statSystem',
        title: '数值成长系统',
        desc: '多维属性进度条 + 初始加点 + 一切增减留痕',
        impact: '会生成 experience-system 接入：validateExperienceSetup / applyAttributeDeltas',
    },
    {
        value: 'eventSystem',
        title: '加权突发事件',
        desc: '事件按「阶段曲线 × 属性护盾 × 状态」算真实概率，seed 存档可回放',
        impact: '会生成事件定义表 + 概率引擎 + 每日确定性掷签 + 风险透明面板',
    },
    {
        value: 'saveSystem',
        title: '多档存档',
        desc: '开档 / 读档 / 换档 / 结局；重开时间归零、配置保留',
        impact: '会生成 profile（档案键级）与 save（档级）两层数据 + 重置语义',
    },
    {
        value: 'npcSystem',
        title: '确定性 NPC 名册',
        desc: '素材池拼人设（类 MBTI），同档案永远同一批人，不烧 token',
        impact: '会生成 NPC 素材池 + seeded 生成器 + 启停管理 + 注册进角色库',
    },
];

/** 读系统数据的能力，单列出来是因为它们都要等 settingsSdk 就绪 */
export const SYSTEM_READS = [
    { value: 'persona', title: '读人设', desc: '当前激活的 AI 是谁、什么性格', api: 'settingsSdk.aiPersons' },
    { value: 'user', title: '读用户卡', desc: '「我」是谁，绑了哪个 API', api: 'settingsSdk.defaultUserCard' },
    { value: 'world', title: '读世界观', desc: '当前世界、地点、时间线', api: 'settingsSdk.worlds / places' },
    { value: 'promptLib', title: '读 Prompt 库', desc: '用户启用的提示词组', api: 'settingsSdk.prompts' },
    { value: 'diary', title: '读日记日程', desc: '人设的日记与日程', api: 'settingsSdk.diaries / schedules' },
];

/** 往别的 App 里注册东西 */
export const CROSS_APP = [
    {
        value: 'promptToMurmur',
        title: '往 murmur 注册提示词',
        desc: '让 AI 在聊天时知道你这个 App 里发生了什么',
        detail: '注册后，murmur 的「回复提示词」页会多出你这个 App 的一组卡片，用户可以逐条开关和编辑。',
    },
    {
        value: 'socialProfile',
        title: '声明为社交 App',
        desc: '用户和 AI 在你这个 App 里有独立的网名和头像',
        detail: '声明后 nook 的人设编辑器会自动出现一张「社媒形象」卡，数据存在 persona.socialProfiles[appId]。',
    },
    {
        value: 'islandKinds',
        title: '声明灵动岛形态',
        desc: '让用户能预览和单独关掉你的岛',
        detail: '不声明也能弹岛，但用户在「灵动岛与小组件」里看不到、也关不掉它。',
    },
    {
        value: 'appStore',
        title: '进 App Store',
        desc: '需要用户先安装才出现在桌面',
        detail: 'distribution.requiresInstall = true。调试期建议先关掉，否则容易以为 App 没注册上。',
    },
    // ★ v0.90 生涯 → 社交的标准通道
    {
        value: 'socialInfluence',
        title: '影响社交 App（热搜/私信）',
        desc: '你的 App 里发生的事，会出现在氧气热搜和萤火私信里',
        detail: '注册 social-influence provider（只输出概要文本、不调 AI），氧气/萤火在用户点击生成时收集。热搜词条会被标注「与你有关」。',
    },
    {
        value: 'worldMode',
        title: '绑定专属世界模式',
        desc: '只在某种体验模式的世界出现（演员/爱豆/电竞/修仙/末日）',
        detail: 'worldAvailability.includeModes + requiresBoundWorld。requiresInstall 设 false 可让对应世界的桌面自动出现该 App。',
    },
];

// ===========================================================================
// 页面预设 —— 「主页面有几个」那道题的快速起点
// ===========================================================================

export const PAGE_PRESETS = [
    {
        value: 'list-mine',
        title: '清单 + 我的',
        desc: '两页。最常见的结构。',
        pages: [
            { name: '首页', desc: '主要内容列表', layout: 'column', cards: ['row'], subpages: ['detail', 'edit'] },
            { name: '我的', desc: '个人中心与设置', layout: 'groupedList', cards: ['row'], subpages: ['settings'] },
        ],
    },
    {
        value: 'feed-discover-mine',
        title: '首页 + 发现 + 我的',
        desc: '三页。内容型 App 的标配。',
        pages: [
            { name: '首页', desc: '关注的内容流', layout: 'column', cards: ['info', 'media'], subpages: ['detail'] },
            { name: '发现', desc: '推荐与分类浏览', layout: 'twoColumn', cards: ['media'], subpages: ['detail', 'search'] },
            { name: '我的', desc: '个人中心', layout: 'groupedList', cards: ['row'], subpages: ['settings', 'history'] },
        ],
    },
    {
        value: 'dashboard',
        title: '概览 + 记录 + 统计',
        desc: '三页。记账、习惯、健康这类。',
        pages: [
            { name: '概览', desc: '今日数据与快捷入口', layout: 'grid', cards: ['stat', 'progress'], subpages: ['detail'] },
            { name: '记录', desc: '所有历史条目', layout: 'column', cards: ['row'], subpages: ['detail', 'edit', 'filter'] },
            { name: '统计', desc: '图表与趋势', layout: 'column', cards: ['bars', 'stat'], subpages: ['detail'] },
        ],
    },
    {
        value: 'single',
        title: '单页工具',
        desc: '一页。计算器、转换器、生成器这类。',
        pages: [
            { name: '主页', desc: '全部功能都在这一页', layout: 'column', cards: ['info'], subpages: ['settings'] },
        ],
    },
    {
        value: 'shopping',
        title: '购物 App',
        desc: '商品浏览 + 购物车 + 订单管理。',
        pages: [
            { name: '首页', desc: '商品推荐与分类', layout: 'twoColumn', cards: ['product'], subpages: ['detail'] },
            { name: '购物车', desc: '已选商品与结算', layout: 'column', cards: ['product'], subpages: ['detail'] },
            { name: '我的订单', desc: '历史订单与状态', layout: 'column', cards: ['order'], subpages: ['detail'] },
            { name: '我的', desc: '个人中心', layout: 'groupedList', cards: ['row'], subpages: ['settings'] },
        ],
    },
    {
        value: 'job',
        title: '求职 App',
        desc: '职位搜索 + 简历投递 + 申请记录。',
        pages: [
            { name: '发现', desc: '推荐职位列表', layout: 'column', cards: ['job'], subpages: ['detail'] },
            { name: '投递记录', desc: '已申请的职位', layout: 'column', cards: ['job'], subpages: ['detail'] },
            { name: '我的', desc: '个人中心', layout: 'groupedList', cards: ['row'], subpages: ['settings'] },
        ],
    },
    {
        value: 'custom',
        title: '自己定',
        desc: '从零开始加页面',
        pages: [
            { name: '首页', desc: '', layout: 'column', cards: ['info'], subpages: [] },
        ],
    },
];

// ===========================================================================
// 存储
// ===========================================================================

export const STORE_PRESETS = [
    { value: 'items', title: '条目表', desc: '一条 = 一个用户创建的东西', keyPath: 'id' },
    { value: 'settings', title: '偏好表', desc: '一条 = 一个设置项', keyPath: 'key' },
    { value: 'history', title: '历史表', desc: '一条 = 一次操作记录', keyPath: 'id' },
    { value: 'assets', title: '素材表', desc: '一条 = 一张图 / 一段音（dataUrl）', keyPath: 'id' },
    // ★ v0.88 购物相关存储
    { value: 'products', title: '商品表', desc: '一条 = 一个商品（含名称、价格、图片）', keyPath: 'id' },
    { value: 'cart', title: '购物车表', desc: '一条 = 购物车内一件商品（商品ID + 数量）', keyPath: 'id' },
    { value: 'orders', title: '订单表', desc: '一条 = 一笔订单（含状态、金额、时间）', keyPath: 'id' },
    // ★ v0.88 求职相关存储
    { value: 'jobs', title: '职位表', desc: '一条 = 一个职位（含公司、薪资、要求）', keyPath: 'id' },
    { value: 'applications', title: '申请表', desc: '一条 = 一次投递记录（含职位ID、时间、状态）', keyPath: 'id' },
    { value: 'resumes', title: '简历表', desc: '一条 = 一份简历（基本信息、教育、工作经历）', keyPath: 'id' },
];

export const DRAFT_KEY = 'xiaoting::app-maker-draft-v1';
