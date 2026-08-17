/**
 * 声浪（esports-forum）· 常量 —— 电竞世界的「数值真相」
 *
 *   - 八张表名 / 提示词 id / 超时
 *   - 七维属性（操作 / 意识 / 沟通 / 英雄池 / 心态 / 体能 / 团队默契）+ 人气（起点锁定）
 *   - 起点定位（青训替补 → 世界第一人：预算 / 月薪 / 赢场奖金 / 巅峰分）
 *   - 赛事预设（段锚点：四大赛 + 娱乐赛，全部可编辑）与节日预设（点锚点）
 *   - SAB 赛制结构常量（KPL 2026 现行版：三轮常规 + 卡位赛 + 双败季后赛）
 *   - NPC 素材池（战队名 / 选手 ID / 本名 / MBTI / 细节 / 串子率）
 *   - 论坛内容素材池（五种立场的帖子与评论，JS 确定性拼装，零 token）
 *   - 突发事件库（人气加权曲线 × 属性护盾，与追光同一套数学）
 *
 * 所有概率与数值集中在这里声明，引擎文件只做计算，不藏数字。
 */

// ===========================================================================
// 表 / 存储 / 提示词
// ===========================================================================

export const STORES = Object.freeze({
    profiles: 'esfProfiles',      // 一档案键一条：首配 + 战队与名册定制 + 锚点 + 社媒偏好 + 小号 + 台账
    saves: 'esfSaves',            // 档：时钟 / 属性 / 精力 / 赛季状态 / 荣誉 / 已发薪月
    posts: 'esfPosts',            // 论坛帖（用户帖 / AI 帖 / 赛后帖 / 战绩围观帖）
    comments: 'esfComments',      // 评论（按 seq 排）
    ratings: 'esfRatings',        // 用户给选手打的分（粉丝均分由 JS 现算）
    events: 'esfEvents',          // 事件日志（突发 / 公告 / 节日）
    timeline: 'esfTimeline',      // 每档大事记（major 同步世界观时间轴）
    stageCards: 'esfStageCards',  // 阶段卡（跨档保留）
});

export const LS_KEYS = Object.freeze({
    draft: 'xiaoting::esports-setup-draft-v1',
});

export const TIMEOUT = Object.freeze({
    normal: 90000,
    long: 150000,
});

/** murmur 提示词 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'esports-forum-shared',
    careerPrefix: 'esports-career-',
});

// ===========================================================================
// 七维属性 + 人气
// ===========================================================================

export const ATTR_MAX = 100;

export const ATTR_DEFS = Object.freeze([
    { key: 'mechanics', label: '操作', short: '操', desc: '手上功夫，极限反应与细节处理' },
    { key: 'awareness', label: '意识', short: '识', desc: '地图阅读、时机判断与大局观' },
    { key: 'comms', label: '沟通', short: '沟', desc: '报点、指挥与情绪传递' },
    { key: 'pool', label: '英雄池', short: '池', desc: '可上场的英雄/角色广度' },
    { key: 'mentality', label: '心态', short: '心', desc: '逆风、网暴与决胜局下的稳定' },
    { key: 'stamina', label: '体能', short: '体', desc: '长赛程与高强度训练的续航' },
    { key: 'synergy', label: '团队默契', short: '契', desc: '与队友的化学反应' },
    { key: 'fame', label: '人气', short: '名', desc: '由起点定位锁定，随生涯变动', locked: true },
]);

export const ATTR_KEYS = Object.freeze(ATTR_DEFS.map((a) => a.key));
export const ALLOC_KEYS = Object.freeze(ATTR_DEFS.filter((a) => !a.locked).map((a) => a.key));

export function attrLabel(key) {
    return ATTR_DEFS.find((a) => a.key === key)?.label || key;
}

// ===========================================================================
// 起点定位（六档）
// ===========================================================================

export const START_TIERS = Object.freeze([
    {
        tier: 1, label: '青训替补', group: '板凳末端',
        desc: '名字挂在大名单最后一行，粉丝群不到两百人',
        fameBase: 4, budget: 330, monthSalary: 4000, winBonus: 1000, peakRating: 1500,
    },
    {
        tier: 2, label: '二队首发', group: '发展联赛',
        desc: '打次级联赛，偶尔被一队拉去当陪练',
        fameBase: 12, budget: 360, monthSalary: 9000, winBonus: 2000, peakRating: 1650,
    },
    {
        tier: 3, label: '一队新秀', group: '首发边缘',
        desc: '刚提上一队的新人，输一场就会被喊「下放」',
        fameBase: 25, budget: 390, monthSalary: 20000, winBonus: 4000, peakRating: 1800,
    },
    {
        tier: 4, label: '一队主力', group: '稳定首发',
        desc: '战队体系里的固定拼图，赛区观众都叫得出你的 ID',
        fameBase: 45, budget: 420, monthSalary: 60000, winBonus: 8000, peakRating: 1950,
    },
    {
        tier: 5, label: '明星选手', group: '票房招牌',
        desc: '全明星票选常客，输赢都在热搜上',
        fameBase: 68, budget: 450, monthSalary: 150000, winBonus: 15000, peakRating: 2100,
    },
    {
        tier: 6, label: '世界第一人', group: '版本答案',
        desc: '这个位置的天花板，所有战队的战术都围绕怎么针对你',
        fameBase: 90, budget: 480, monthSalary: 400000, winBonus: 30000, peakRating: 2300,
    },
]);

export function startTierSpec(tier) {
    const n = Number(tier);
    const t = Math.min(6, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
    return START_TIERS.find((s) => s.tier === t) || START_TIERS[0];
}

// ===========================================================================
// 赛事预设（段锚点）—— 四大赛 + 娱乐赛，用户可增删改
// ===========================================================================

export const TOURNAMENT_PRESETS = Object.freeze([
    {
        id: 't-spring', name: '春霖杯·春季赛', kind: 'major', format: 'sab',
        desc: '年度第一个大满贯，SAB 全赛程', prizeChampion: 500000, prizeRunner: 200000,
        gapDays: 7, enabled: true,
    },
    {
        id: 't-challenger', name: '裂隙挑战者杯', kind: 'major', format: 'cup',
        desc: '十强邀请制快节奏杯赛，单循环加四强单败', prizeChampion: 200000, prizeRunner: 80000,
        gapDays: 5, enabled: true,
    },
    {
        id: 't-summer', name: '骄阳杯·夏季赛', kind: 'major', format: 'sab',
        desc: '决定年度总决赛门票的下半年大满贯', prizeChampion: 500000, prizeRunner: 200000,
        gapDays: 7, enabled: true,
    },
    {
        id: 't-annual', name: '岁末巅峰·年度总决赛', kind: 'major', format: 'cup',
        desc: '一年的终点，冠军戒指在这里发', prizeChampion: 1000000, prizeRunner: 400000,
        gapDays: 12, enabled: true,
    },
    {
        id: 't-allstar', name: '全明星周末', kind: 'fun', format: 'showmatch',
        desc: '娱乐表演赛：solo 王中王、水友对抗、位置互换局', prizeChampion: 50000, prizeRunner: 20000,
        gapDays: 3, enabled: true,
    },
    {
        id: 't-rookie', name: '新星闪光赛', kind: 'fun', format: 'showmatch',
        desc: '替补与青训的舞台，老将只能坐解说席', prizeChampion: 30000, prizeRunner: 10000,
        gapDays: 3, enabled: true,
    },
]);

// ===========================================================================
// 节日预设（点锚点）
// ===========================================================================

export const FESTIVAL_PRESETS = Object.freeze([
    { id: 'fest-transfer', name: '转会窗开启日', everyDays: 110, desc: '合同与流言齐飞，官宣海报刷屏的一天' },
    { id: 'fest-award-night', name: '年度颁奖夜', everyDays: 360, desc: '年度最佳阵容与年度 MVP 在这里揭晓' },
    { id: 'fest-fan-carnival', name: '粉丝嘉年华', everyDays: 90, desc: '见面会、签名与应援棒的海洋' },
    { id: 'fest-patch-day', name: '版本更新日', everyDays: 45, desc: '版本答案洗牌，英雄池浅的选手集体加班' },
    { id: 'fest-club-anniv', name: '俱乐部周年庆', everyDays: 180, desc: '战队生日，官博发年度混剪的日子' },
]);

// ===========================================================================
// 赛制结构常量
// ===========================================================================

/** SAB：KPL 2026 现行版 */
export const SAB = Object.freeze({
    TEAMS: 18,
    GROUPS: 3,             // 第一轮 3 个初始小组（每组 6）
    GROUP_SIZE: 6,
    R1_BO: 5, R2_BO: 5, R3_BO: 5,
    GATE_BO: 7,            // 卡位赛 BO7
    PLAYOFF_BO: 7,         // 季后赛全程 BO7（第七局巅峰对决：双方盲选）
    R1_PER_DAY: 3,         // 每个比赛日 3 场（每组一场）
    R2_PER_DAY: 3,
    R3_PER_DAY: 2,
    GATE_PER_DAY: 2,
    REST_DAYS: 2,          // 阶段之间休 2 天
    POINTS_WIN: 1,         // 赢一大场积 1 分；同分比净胜小分，再比交手胜负
});

/** 挑战者杯（cup）：十强单循环 BO5（每天一轮 5 场）+ 四强单败 BO7 */
export const CUP = Object.freeze({
    TEAMS: 10,
    RR_BO: 5,
    KO_BO: 7,
    REST_DAYS: 1,
});

/** 娱乐表演赛：固定天数的节目单，不进积分 */
export const SHOWMATCH_DAYS = 2;

export const FORMAT_LABELS = Object.freeze({
    sab: 'SAB 升降分组赛制',
    cup: '十强杯赛（单循环+四强）',
    showmatch: '娱乐表演赛',
});

// ===========================================================================
// 薪资 / 奖金
// ===========================================================================

export const SALARY_PERIOD_DAYS = 30;      // 每 30 天发一次月薪
export const MVP_BONUS_FACTOR = 0.5;       // 系列赛 MVP 追加 50% 赢场奖金

// ===========================================================================
// NPC 素材池 —— 确定性拼人，零 token
// ===========================================================================

export const NPC_POOLS = Object.freeze({
    /** 战队名 = 地名 + 图腾；tag 由引擎取拼音风首字母 */
    cities: Object.freeze([
        '临江', '望京', '沧澜', '雾川', '星港', '白屿', '南栀', '黎明', '风陵', '云归',
        '朔方', '汀州', '焰城', '澜山', '北落', '青崖', '灰雀', '远夏', '暮桥', '砾原',
    ]),
    totems: Object.freeze([
        '猎隼', '雷雀', '白鲨', '夜枭', '苍狼', '赤狐', '玄武', '游鲸', '烛龙', '雪豹',
        '黑鸢', '银蟒', '穷奇', '灵猫', '斑鸠', '孤鹰', '海东青', '貔貅', '朱厌', '重明鸟',
    ]),
    /** 选手游戏 ID（中文系） */
    cnIds: Object.freeze([
        '北桥', '野火', '星回', '二两', '迟枫', '小满', '无别', '鹿鸣', '拾一', '白汽',
        '南酌', '几时', '暮山', '惊竹', '远洲', '三金', '半岛', '木鱼', '荒年', '青祭',
        '灯芯', '孤注', '折镜', '晚风急', '不吃香菜', '大梦', '过山', '空山', '侧耳', '雾都',
        '短刀', '长歌', '压线', '满穗', '闻鹤', '一苇', '皮蛋', '瓦松', '老猫', '春困',
        '止水', '燃点', '退潮', '断层', '亡命', '细雨', '重启', '低语', '飞白', '守夜',
    ]),
    /** 选手游戏 ID（英文系） */
    enIds: Object.freeze([
        'Rime', 'Nio', 'Vast', 'Kuro', 'Aria', 'Bloom', 'Echo', 'Lumen', 'Pique', 'Sable',
        'Vesper', 'Halcy', 'Onyx', 'Quill', 'Ferro', 'Nadir', 'Cinder', 'Vellum', 'Sorin', 'Tacet',
        'Brume', 'Kanae', 'Altair', 'Corvus', 'Nimbus', 'Rasp', 'Weiss', 'Torrent', 'Fable', 'Grit',
        'Mistral', 'Pavane', 'Lacuna', 'Verge', 'Solace', 'Kindle', 'Umbra', 'Zephyr', 'Havoc', 'Prism',
    ]),
    surnames: Object.freeze([
        '沈', '顾', '陆', '江', '苏', '林', '傅', '祁', '温', '霍', '许', '纪', '闻', '裴', '岑', '容',
        '厉', '晏', '池', '桑', '简', '黎', '骆', '喻', '虞', '邵', '柯', '蔺', '穆', '禹', '孟', '尹',
    ]),
    givens: Object.freeze([
        '砚', '青临', '晚舟', '斯年', '既白', '疏影', '照野', '明微', '知许', '归鸿', '南絮', '亦安',
        '书淮', '若疏', '临深', '照雪', '衔月', '成蹊', '望舒', '扶摇', '既明', '朝暮', '星阑', '迟迟',
        '一苇', '经年', '闻笛', '栖迟', '云亭', '嘉树', '清晏', '灼灼', '知遇', '未晞', '青梧', '雪满',
    ]),
    mbti: Object.freeze([
        'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
        'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
    ]),
    traits: Object.freeze([
        '赛前必须一个人静坐十分钟', '输了嘴硬赢了脸红', '训练赛狂人，凌晨四点还在拉人开黑',
        '地图理解怪，复盘时全队都听他的', '手比脑子快', '决胜局越紧张越想笑',
        '对版本改动过目不忘', '装备党，鼠标垫换得比衣服勤', '赛后采访金句制造机',
        '嘴上全是垃圾话，操作全是真感情', '从不看自己的比赛回放', '给每个英雄起外号',
        '外卖只点同一家', '手感玄学信徒，椅子高度精确到毫米', '粉丝眼里的高冷，队友眼里的话痨',
        '心态钢板，0:2 落后也面无表情', '容易上头，越禁他英雄他越想秀', '记得住所有对手的击杀语音',
        '休赛期一条动态不发', '直播里全是节目效果，比赛里全是杀气', '吃到关键资源会小声说谢谢',
        '永远第一个到训练室', '赢了请全队奶茶', '偷偷收藏黑自己的帖子', '被喷就打排位泄愤',
        '会在版本前夜通宵测新套路', '给替补讲战术比教练还细', '袜子必须穿同一双「胜利袜」',
        '每次大赛前剪指甲', '喜欢在泡面时间聊人生',
    ]),
    quirks: Object.freeze([
        '外设箱里藏着出道那年的旧键盘', '手机屏保是第一次夺冠的比分', '赛前要摸一下队标',
        '总带着一包没人见过他吃的糖', '直播间背景永远拉着窗帘', '写复盘笔记用三种颜色的笔',
        '每逢大赛就换新手绳', '休息日去网吧打匿名路人局', '给键盘起了名字',
        '存着一条没发出去的退役微博草稿', '比赛服左袖比右袖短一截', '夺冠语音循环听了三年',
        '训练室座位下贴着一张便利贴', '只用某个停产的鼠标型号', '赢下天王山之战后会去吃一碗面',
        '有个只有三个人知道的小号', '把每次被喷的词条截图存相册', '决赛日穿妈妈寄来的袜子',
    ]),
    agendas: Object.freeze([
        '想在退役前拿一个属于自己的 FMVP', '在攒钱给家里换房子', '想证明当年放弃保送是对的',
        '偷偷准备着转型解说', '想把青训时的兄弟带上一队', '在等一个向老东家复仇的机会',
        '合同年，每一场都在打身价', '伤病比公开的严重，在硬撑', '想成为家乡第一个世界冠军',
        '被父母反对入行，想用冠军和解', '暗恋着某个不能说的人', '在写一本没人知道的训练日记',
        '想打破「天才陨落」的剧本', '筹划着自己的青训营', '只想安安静静打完最后一个赛季',
    ]),
    attitudes: Object.freeze([
        { id: 'admire', label: '欣赏你', bias: 8 },
        { id: 'rival', label: '视你为对手', bias: 2 },
        { id: 'neutral', label: '公事公办', bias: 0 },
        { id: 'doubt', label: '不服你', bias: -4 },
        { id: 'cold', label: '看衰你', bias: -8 },
    ]),
    /** 解说 / 记者 / 圈内大 V（论坛常驻发声者） */
    casters: Object.freeze(['临风解说', '老白开麦', '一觉解说', '梅子姐说赛'])
,
    reporters: Object.freeze(['电竞前哨站', '赛区内幕君']),
    bigVs: Object.freeze(['峡谷显微镜', '数据不会说谎', '赛后乐子人']),
});

/** 串子率：这个比例的选手有论坛小号（确定性掷定） */
export const LURKER_RATE = 0.3;
/** 小号改名：平均每这么多天掷一次改名签 */
export const ALT_RENAME_DAYS = 15;

/** 路人网名池（帖子与评论作者） */
export const FAN_HANDLES = Object.freeze([
    '峡谷第一深情', '蹲战报的', '野区经济学家', '二楼观众', '不看比赛看人', '地铁老人看手机',
    '暴躁老哥在线锐评', '理性讨论怪', '数据帝本帝', '前青训现网瘾', '开赛就困', '决胜局心脏病人',
    '全联盟的妈妈粉', '嗑巅峰分的', '只看下路', '战术板搬运工', '赛区遗老', '票价刺客受害者',
    '凌晨三点的复盘人', '弹幕护卫队', '塑料分析师', '万年潜水今日冒泡', '买了周边才有资格喷',
    '路过的隔壁赛区人', '主队夺冠就退网', '连跪玩家的怨气', '教练视角爱好者', '经济面板盯梢员',
    'banpick研究所', '菠萝头观赛', '替补席观察日记', '拖着老板来看比赛', '高考完补赛的',
    '现场票根收藏家', '看了八年的老粉', '云观众自觉排队', '今天也没等到官宣', '训练赛小道消息',
]);

// ===========================================================================
// 论坛内容素材池（占位符：{team} {opp} {player} {user} {score} {hero} {rank} {pos}）
// ===========================================================================

export const STANCES = Object.freeze([
    { id: 'fan', label: '粉丝' },
    { id: 'anti', label: '黑子' },
    { id: 'passerby', label: '路人' },
    { id: 'analyst', label: '分析' },
    { id: 'memer', label: '乐子人' },
]);

export const POST_POOLS = Object.freeze({
    fanTitles: Object.freeze([
        '{team}今天的运营真的干净，谁看了不说一句赏心悦目',
        '吹爆{player}的{pos}，这就是版本答案',
        '有没有人发现{team}最近的 banpick 越来越成熟了',
        '{player}今天这波处理，值得进年度十佳',
        '从青训一路看{player}长大的，眼泪不值钱',
    ]),
    antiTitles: Object.freeze([
        '不是我说，{team}这个阵容思路真的该换教练了',
        '{player}最近状态肉眼可见的下滑，还有人吹？',
        '就这？{team}粉丝别再吹什么世一了',
        '理性讨论：{player}是不是被版本抬起来的',
        '{team}再这么打，季后赛门票都悬',
    ]),
    passerbyTitles: Object.freeze([
        '路人问一句，{team}和{opp}谁更被看好？',
        '第一次看比赛，{pos}位到底在干嘛，求科普',
        '今天的比赛值得回放吗？上班没看成',
        '为什么大家都在刷{player}，发生什么了',
        '这赛季黑马是谁？想入坑一个队',
    ]),
    analystTitles: Object.freeze([
        '深度：从数据面看{team}的前期节奏问题',
        '复盘{team} vs {opp}：胜负手其实在第 14 分钟',
        'banpick 拆解：{opp}为什么连续三局放出{hero}',
        '积分形势分析：{team}还有多少出线可能',
        '版本红利榜：谁在吃版本，谁在被版本吃',
    ]),
    memerTitles: Object.freeze([
        '不懂就问，{player}的手是不是充电了',
        '{team}：我们不进则退，退亦是进（玄学发言）',
        '今日乐子：解说口误合集又更新了',
        '赛区没有秘密：今天训练赛外卖名单流出（bushi）',
        '{player}赛后采访："还行吧"（全场爆笑）',
    ]),
    fanComments: Object.freeze([
        '看了三遍回放，{player}这波真的神', '我们{team}终于支棱起来了', '这就是我担心的点，还好赢了',
        '泪目，从没人看好到现在', '下一场继续加油，别飘', '官博快剪高光！等着二创',
        '谁黑{player}我跟谁急', '这个 ban 位留得太聪明了', '主场票已买，等一个面签',
    ]),
    antiComments: Object.freeze([
        '赢了才吹的都是事后诸葛', '版本一换看他还怎么秀', '就打了一场好的，粉丝别急着造神',
        '对面失误送的，别不承认', '数据好看有什么用，关键局呢', '等他掉线级的时候你们别哭',
    ]),
    passerbyComments: Object.freeze([
        '不懂但大受震撼', '路过，觉得两边都挺强', '解说喊得我心脏受不了', '所以下一场什么时候打？',
        '有直播间链接吗', '这游戏观赏性可以啊', '楼上科普辛苦了',
    ]),
    analystComments: Object.freeze([
        '同意，前期资源置换亏太多了', '其实换个思路：这波必须开，不开更亏', '数据贴上了，参团率说明一切',
        '版本节奏就是这样，怪不了选手', '建议看一下第 9 分钟的视野布置', '这个细节确实只有懂的人才看得出来',
    ]),
    memerComments: Object.freeze([
        '哈哈哈哈哈哈救命', '节目效果直接拉满', '已做成表情包，感谢馈赠', '乐子人路过，都别吵',
        '这条评论区比比赛好看', '蹲一个鬼畜区剪辑',
    ]),
    /** 官博文案（战队官方账号在板块里的动态） */
    officialWin: Object.freeze([
        '【赛报】{score} 拿下 {opp}！今晚的胜利属于每一位守在屏幕前的你。下一场，继续并肩。',
        '【WIN】终测回响，尘埃落定 —— {team} {score} {opp}。感谢现场与直播间的每一声呐喊。',
    ]),
    officialLose: Object.freeze([
        '【赛报】{score} 不敌 {opp}。低谷不长驻，复盘已开始。感谢陪伴，来日再战。',
        '【END】今天以 {score} 告负。承认差距，然后追上它。{team} 从不背对风口。',
    ]),
    officialAnnounce: Object.freeze([
        '【官宣】新赛季大名单公示，感谢每一位选手的坚持。',
        '【周边】新款应援围巾上架，主场见。',
        '【训练日常】今日份训练室谍照，猜猜谁又加练到最后。',
    ]),
    /** 战绩围观帖（论坛看到 rank 记录并点评） */
    rankWatchTitles: Object.freeze([
        '扒到{user}今天的巅峰赛战绩，来品品',
        '{user}凌晨还在冲分？这战绩你们怎么看',
        '今日选手巅峰赛观察帖：{user}篇',
    ]),
    rankWatchGood: Object.freeze([
        '这胜率没得黑，状态真回来了', '连着赢，看来最近训练量到位', '路人局都这么认真，好感+1',
        '这把{hero}的数据也太漂亮了', '巅峰分又涨了，赛场上见真章',
    ]),
    rankWatchBad: Object.freeze([
        '这胜率……教练看了会沉默', '连跪还在排，心态是真好（反话）', '快去睡觉吧，明天还有训练',
        '是不是又在练新英雄，理解但心疼分', '状态堪忧，下一场比赛悬了',
    ]),
    ratingComments: Object.freeze([
        '稳定发挥，给分不亏', '上限很高下限也低，赌博式选手', '被低估了，数据不会说谎',
        '人气分居多，实际表现一般', '大场面选手，越关键越敢打', '还年轻，给点时间',
    ]),
});

// ===========================================================================
// 突发事件库（人气加权曲线：base=人气0，peak=人气100，指数插值）
// ===========================================================================

export const EVENT_KINDS = Object.freeze({
    scandal: { id: 'scandal', label: '舆情', tone: 'danger' },
    chance: { id: 'chance', label: '机遇', tone: 'success' },
    form: { id: 'form', label: '状态', tone: 'info' },
    industry: { id: 'industry', label: '行业', tone: 'warn' },
});

export const EVENT_DEFS = Object.freeze([
    {
        id: 'flamed-trending', kind: 'scandal', title: '被喷上热搜',
        desc: '一波失误被剪成十五秒短视频疯传，词条后面挂着一个「爆」。',
        curve: { base: 0.02, peak: 0.55 },
        guards: [
            { attr: 'mentality', pivot: 55, factor: 0.6 },
            { attr: 'synergy', pivot: 55, factor: 0.85 },
        ],
        shieldable: true, cooldownDays: 7,
        options: [
            { id: 'respond', label: '直播正面回应', effects: { attrs: { mentality: 2, fame: -2 }, note: '有人被你圈粉，也有人截了新的图' } },
            { id: 'cold', label: '关评论冷处理', effects: { attrs: { fame: -4, mentality: 1 }, note: '词条挂了两天自己沉了' } },
            { id: 'pr', label: '俱乐部公关压词条', costKind: 'pr', effects: { attrs: { fame: -1 }, note: '钱花出去了，热搜悄悄没了' } },
        ],
        autoEffects: { attrs: { fame: -5, mentality: -2 } },
    },
    {
        id: 'anti-fan-attack', kind: 'scandal', title: '黑粉有组织网暴',
        desc: '小作文带节奏，评论区被同一套话术刷屏。',
        curve: { base: 0.03, peak: 0.45 },
        guards: [{ attr: 'mentality', pivot: 50, factor: 0.55 }],
        shieldable: true, cooldownDays: 9,
        options: [
            { id: 'lawyer', label: '俱乐部发律师函', effects: { attrs: { mentality: 2, fame: 1 }, note: '带头的号连夜清空了主页' } },
            { id: 'mute', label: '卸载社媒专心训练', effects: { attrs: { mechanics: 1, fame: -2 }, note: '眼不见心不烦，手感倒是稳了' } },
            { id: 'fight', label: '小号开麦对线', effects: { gamble: { chance: 0.4, win: { note: '骂赢了，还顺手涨了点乐子粉', attrs: { fame: 2 } }, lose: { attrs: { fame: -8, mentality: -3 }, note: '小号被扒了，场面一度非常难看' } } } },
        ],
        autoEffects: { attrs: { mentality: -3, fame: -2 } },
    },
    {
        id: 'stream-slip', kind: 'scandal', title: '直播失言',
        desc: '深夜直播随口一句被切片，语境全丢，只剩那半句。',
        curve: { base: 0.02, peak: 0.3 },
        guards: [{ attr: 'comms', pivot: 55, factor: 0.6 }],
        shieldable: true, cooldownDays: 12,
        options: [
            { id: 'apologize', label: '道歉澄清', effects: { attrs: { fame: -2 }, note: '风波渐平，切片还在流传' } },
            { id: 'clip', label: '发完整录屏自证', effects: { attrs: { fame: 1, mentality: 1 }, note: '完整语境一出，风向反转' } },
        ],
        autoEffects: { attrs: { fame: -3 } },
    },
    {
        id: 'burner-exposed', kind: 'scandal', title: '小号被扒', requiresAlt: true,
        desc: '有人对比发帖时间和训练赛日程，把你的论坛小号锤了个八九不离十。',
        curve: { base: 0.015, peak: 0.28 },
        guards: [{ attr: 'mentality', pivot: 60, factor: 0.75 }],
        shieldable: false, cooldownDays: 30,
        options: [
            { id: 'deny', label: '死不承认', effects: { gamble: { chance: 0.5, win: { note: '查无实据，帖子沉了' }, lose: { attrs: { fame: -5 }, note: '第二天实锤截图出现了' } } } },
            { id: 'admit', label: '大方承认玩梗', effects: { attrs: { fame: 3, mentality: 1 }, note: '「选手也是网友」冲上热搜，路人缘暴涨' } },
            { id: 'abandon', label: '弃号跑路', effects: { note: '小号从此停更，成为都市传说' } },
        ],
        autoEffects: { attrs: { fame: -2 } },
    },
    {
        id: 'teamroom-rumor', kind: 'scandal', title: '队内不和传闻',
        desc: '营销号发文《某队更衣室已经炸了》，虽然没点名，配图是你们基地。',
        curve: { base: 0.02, peak: 0.25 },
        guards: [{ attr: 'synergy', pivot: 55, factor: 0.5 }],
        shieldable: true, cooldownDays: 14,
        options: [
            { id: 'group-photo', label: '全队合照辟谣', effects: { attrs: { synergy: 1, fame: 1 }, note: '一张全员挤在泡面堆里的合照，谣言不攻自破' } },
            { id: 'ignore', label: '懒得理会', effects: { attrs: { fame: -2 }, note: '信的人还是会信' } },
        ],
        autoEffects: { attrs: { synergy: -1, fame: -1 } },
    },
    {
        id: 'hand-hot', kind: 'form', title: '手感火热',
        desc: '今天的每一发技能都像有磁铁，训练赛全场最佳。',
        curve: { base: 0.06, peak: 0.12 },
        guards: [{ attr: 'mechanics', pivot: 50, factor: 1.3 }],
        cooldownDays: 5,
        autoEffects: { attrs: { mechanics: 1 }, energy: 10, note: '状态正佳，今天多打两把值得' },
    },
    {
        id: 'slump', kind: 'form', title: '手感冰凉',
        desc: '连人机都能空刀，越打越急，越急越空。',
        curve: { base: 0.05, peak: 0.1 },
        guards: [{ attr: 'mentality', pivot: 55, factor: 0.7 }],
        cooldownDays: 5,
        options: [
            { id: 'rest', label: '停练休息半天', effects: { energy: 20, note: '睡了一觉，世界清爽了' } },
            { id: 'grind', label: '硬练到手热为止', effects: { attrs: { mechanics: 1, stamina: -1 }, energy: -18, note: '凌晨两点，终于找回一点感觉' } },
        ],
        autoEffects: { energy: -10 },
    },
    {
        id: 'fan-support', kind: 'chance', title: '粉丝大型应援',
        desc: '生日站子包下了大屏，基地收到三十箱写满留言的信。',
        curve: { base: 0.02, peak: 0.3 },
        guards: [{ attr: 'fame', pivot: 40, factor: 1.5 }],
        cooldownDays: 20, minFameBase: 15,
        autoEffects: { attrs: { mentality: 2, fame: 1 }, note: '被这么多人喜欢着，不能输' },
    },
    {
        id: 'brand-deal', kind: 'chance', title: '外设品牌递合同',
        desc: '一线外设品牌想签你做年度代言，样品先寄了一箱。',
        curve: { base: 0.01, peak: 0.35 },
        guards: [{ attr: 'fame', pivot: 45, factor: 1.6 }],
        cooldownDays: 30, minFameBase: 30, pay: 'brand',
        options: [
            { id: 'sign', label: '签约', effects: { attrs: { fame: 2 }, income: 'brand', note: '定制款上架当天售罄' } },
            { id: 'decline', label: '婉拒专心比赛', effects: { attrs: { mentality: 1 }, note: '品牌方说赛季后再聊' } },
        ],
        autoEffects: { attrs: {} },
    },
    {
        id: 'patch-day-shake', kind: 'industry', title: '版本大改',
        desc: '新版本削了你的招牌体系，训练室一夜之间全在开荒。',
        curve: { base: 0.04, peak: 0.06 },
        cooldownDays: 40,
        options: [
            { id: 'grind-new', label: '连夜开荒新版本', effects: { attrs: { pool: 2, stamina: -1 }, energy: -15, note: '天亮时，你已经有了三套新答案' } },
            { id: 'wait', label: '等大家摸出结论再学', effects: { attrs: { pool: -1 }, note: '省了力气，但慢了半拍' } },
        ],
        autoEffects: { attrs: { pool: -1 }, note: '版本红利与你暂时无关' },
    },
    {
        id: 'transfer-rumor', kind: 'industry', title: '转会流言缠身',
        desc: '知名爆料号说有俱乐部为你开出了天价合同，真假难辨。',
        curve: { base: 0.01, peak: 0.2 },
        guards: [{ attr: 'fame', pivot: 50, factor: 1.4 }],
        cooldownDays: 45, minFameBase: 35,
        options: [
            { id: 'clarify', label: '公开表忠心', effects: { attrs: { fame: 1, synergy: 1 }, note: '「我会和这支队伍走到最后」' } },
            { id: 'silent', label: '不回应保持神秘', effects: { attrs: { fame: 2, synergy: -1 }, note: '流言飞了一周，队友有点嘀咕' } },
        ],
        autoEffects: { attrs: {} },
    },
    {
        id: 'scrim-leak', kind: 'industry', title: '训练赛战术泄露',
        desc: '下一个对手似乎提前知道了你们的新体系，训练赛群里人人自危。',
        curve: { base: 0.02, peak: 0.08 },
        cooldownDays: 30,
        autoEffects: { attrs: { synergy: -1 }, note: '教练连夜换了战术板的锁屏密码' },
    },
]);

/** 公关买断价（按人气分段） */
export function prCostByFame(fame) {
    const f = Math.max(0, Math.min(100, Number(fame) || 0));
    return Math.round(3000 * Math.pow(1.032, f));
}

/** 事件 / 快进 / 赛后属性变化钳制 */
export const EVENT_DELTA_CAP = 6;
export const SEASON_DELTA_CAP = 4;
export const FAST_FORWARD_DELTA_CAP = 6;

export const ENERGY_MAX = 100;
export const ENERGY_DANGER = 20;
export const LOW_ENERGY_EVENT_MULTIPLIER = 1.3;

// ===========================================================================
// 页面 tab
// ===========================================================================

export const TABS = Object.freeze([
    { id: 'home', label: '首页', icon: 'wave' },
    { id: 'boards', label: '板块', icon: 'board' },
    { id: 'rating', label: '评分', icon: 'star' },
    { id: 'me', label: '我的', icon: 'me' },
]);
