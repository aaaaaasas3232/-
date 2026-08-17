/**
 * 追光（演员成长之路）· 常量
 *
 * 这里是整个演员系统的「数值真相」：
 *   - 18 线 → 1 线的分线表（知名度基准 / 初始加点预算 / 日薪基准）
 *   - 九维属性（声台形表 + 共情力 / 镜头感 / 人脉圈 / 抗压值 / 知名度）
 *   - 突发事件库（分线加权概率曲线 + 属性护盾 + 选项）
 *   - 奖项预设（段锚点）与世界观节日（点锚点）
 *   - NPC 素材池（姓名 / 职业 / MBTI / 细节 → JS 确定性拼人，不烧 token）
 *   - 日程活动目录（每件事有固定时长与属性效果）
 *
 * 所有概率与数值都集中在这里声明，引擎文件只做计算，不藏数字。
 */

// ===========================================================================
// 表名 / 存储
// ===========================================================================

export const STORES = Object.freeze({
    profiles: 'actorProfiles',      // 一档案键一条：首配 + 30 NPC 名册 + 奖项定义 + 人设改写记录
    saves: 'actorSaves',            // 存档（档）：时钟 / 线级 / 属性 / NPC 启用 / 护盾 / 结局
    events: 'actorEvents',          // 事件日志（突发 / 交际 / 公告 / 隐藏）
    timeline: 'actorTimeline',      // 每档大事记（自动记录，重大的同步世界观时间轴）
    projects: 'actorProjects',      // 剧本 / 项目（梦境编织改编 / AI 生成 / 自建）
    schedules: 'actorSchedules',    // 每档每天的课程与活动安排
    npcChats: 'actorNpcChats',      // NPC 聊天记录（每档隔离）
    stageCards: 'actorStageCards',  // 阶段卡（跨档保留，属性重置不删卡）
});

export const GLOBAL_KEY = 'global';

export const LS_KEYS = Object.freeze({
    draft: 'xiaoting::actor-setup-draft-v1',
});

export const TIMEOUT = Object.freeze({
    normal: 90000,
    long: 150000,
});

/** murmur 提示词 id（发布后不能改） */
export const PROMPT_IDS = Object.freeze({
    shared: 'actor-career-shared',
    stagePrefix: 'actor-stage-',
});

// ===========================================================================
// 分线表：18 线 → 1 线
// ===========================================================================

const TIER_GROUPS = [
    { from: 18, to: 16, group: '无名之辈', groupDesc: '跑组无门，试镜靠蹲，全网搜不到词条' },
    { from: 15, to: 13, group: '边缘糊咖', groupDesc: '有几个龙套镜头，粉丝群不满百人' },
    { from: 12, to: 10, group: '小有水花', groupDesc: '演过叫得出名字的配角，偶尔被认出' },
    { from: 9, to: 7, group: '熟脸演员', groupDesc: '固定戏约，剧宣期能挂上热搜尾巴' },
    { from: 6, to: 4, group: '当红梯队', groupDesc: '一番剧本开始递来，商务与综艺排队' },
    { from: 3, to: 2, group: '一线边缘', groupDesc: '国民度成型，一举一动都有人盯' },
    { from: 1, to: 1, group: '顶流', groupDesc: '站在聚光灯正中央，也站在放大镜正下方' },
];

function tierGroupOf(tier) {
    return TIER_GROUPS.find((g) => tier <= g.from && tier >= g.to) || TIER_GROUPS[0];
}

/**
 * 分线数值：
 *   fameBase   该线的知名度基准（开档时知名度锁定为它）
 *   budget     初始加点预算（分给其余 8 维；线越高预算越高——你已经是成名演员）
 *   dayPay     进组日薪基准（世界观货币）
 *   prCost     买断一次黑料的公关价（线越高越贵）
 */
export function tierSpec(tier) {
    const n = Number(tier);
    const t = Math.min(18, Math.max(1, Math.round(Number.isFinite(n) ? n : 18)));
    const g = tierGroupOf(t);
    const idx = 18 - t; // 0..17
    return {
        tier: t,
        label: `${t}线`,
        group: g.group,
        groupDesc: g.groupDesc,
        fameBase: Math.round(2 + idx * (90 / 17)),
        budget: 140 + idx * 12,
        dayPay: Math.round(300 * Math.pow(1.42, idx)),
        prCost: Math.round(2000 * Math.pow(1.35, idx)),
    };
}

export const TIERS = Object.freeze(
    Array.from({ length: 18 }, (_, i) => Object.freeze(tierSpec(18 - i))),
);

// ===========================================================================
// 九维属性
// ===========================================================================

export const ATTR_MAX = 100;

export const ATTR_DEFS = Object.freeze([
    { key: 'voice', label: '声乐', short: '声', desc: '声音的表现力与控制' },
    { key: 'diction', label: '台词', short: '台', desc: '咬字、节奏与语感' },
    { key: 'body', label: '形体', short: '形', desc: '身体控制与舞台仪态' },
    { key: 'acting', label: '表演', short: '表', desc: '角色理解与信念感' },
    { key: 'empathy', label: '共情力', short: '情', desc: '接住对手戏与观众情绪' },
    { key: 'camera', label: '镜头感', short: '镜', desc: '在镜头里的松弛与准确' },
    { key: 'network', label: '人脉圈', short: '脉', desc: '行业资源与贵人缘' },
    { key: 'resilience', label: '抗压值', short: '抗', desc: '面对舆论与失败的韧性' },
    { key: 'fame', label: '知名度', short: '名', desc: '由线级决定，随生涯变动', locked: true },
]);

export const ATTR_KEYS = Object.freeze(ATTR_DEFS.map((a) => a.key));
export const ALLOC_KEYS = Object.freeze(ATTR_DEFS.filter((a) => !a.locked).map((a) => a.key));

export function attrLabel(key) {
    return ATTR_DEFS.find((a) => a.key === key)?.label || key;
}

// ===========================================================================
// 时间：一天的槽位
// ===========================================================================

export const DAY_SLOTS = Object.freeze([
    { id: 'morning', label: '早', minute: 8 * 60, desc: '上午 8:00' },
    { id: 'noon', label: '中', minute: 13 * 60, desc: '下午 1:00' },
    { id: 'evening', label: '晚', minute: 19 * 60, desc: '晚上 7:00' },
    { id: 'night', label: '深夜', minute: 22 * 60 + 30, desc: '夜里 10:30' },
]);

export const DAY_START_MINUTE = 7 * 60;   // 新的一天从 7:00 开始
export const DAY_END_MINUTE = 24 * 60;    // 24:00 封顶，等用户决定是否跨日

// ===========================================================================
// 日程活动目录（每件事固定时长）
// ===========================================================================

export const ACTIVITIES = Object.freeze([
    { id: 'course-diction', label: '台词课', hours: 2, energy: -12, kind: 'course', effects: { diction: 1 }, desc: '跟老师磨一段独白' },
    { id: 'course-voice', label: '声乐课', hours: 2, energy: -12, kind: 'course', effects: { voice: 1 }, desc: '开嗓、气息与音准' },
    { id: 'course-body', label: '形体课', hours: 2, energy: -14, kind: 'course', effects: { body: 1 }, desc: '体态、走位与镜前姿态' },
    { id: 'course-acting', label: '表演工作坊', hours: 3, energy: -16, kind: 'course', effects: { acting: 1 }, desc: '小剧场即兴与角色练习' },
    { id: 'course-camera', label: '镜头实训', hours: 2, energy: -12, kind: 'course', effects: { camera: 1 }, desc: '对着监视器找角度' },
    { id: 'course-read', label: '剧本围读', hours: 2, energy: -10, kind: 'course', effects: { empathy: 1 }, desc: '和搭档对词，读懂人物' },
    { id: 'fitness', label: '健身训练', hours: 1, energy: -8, kind: 'course', effects: { resilience: 1 }, desc: '身体是演员的本钱' },
    { id: 'shoot', label: '进组拍摄', hours: 4, energy: -26, kind: 'work', effects: {}, desc: '推进当前项目的拍摄进度', needsProject: true },
    { id: 'variety', label: '综艺录制', hours: 3, energy: -20, kind: 'work', effects: { fame: 1 }, desc: '录一期综艺，赚曝光和通告费', pay: true, minFame: 20 },
    { id: 'gala-dinner', label: '晚宴应酬', hours: 2, energy: -18, kind: 'social', effects: { network: 2 }, desc: '固定两小时，人脉是喝出来的' },
    { id: 'industry-party', label: '行业酒会', hours: 2, energy: -16, kind: 'social', effects: { network: 1 }, desc: '可能遇到重要的人', encounter: true },
    { id: 'fan-meet', label: '粉丝互动', hours: 1, energy: -8, kind: 'social', effects: { fame: 1 }, desc: '直播或线下小场', minFame: 10 },
    { id: 'rest', label: '休整', hours: 2, energy: 25, kind: 'rest', effects: {}, desc: '睡一觉，或者只是发呆' },
    { id: 'review', label: '冥想复盘', hours: 1, energy: 10, kind: 'rest', effects: { resilience: 1 }, desc: '安静下来，把今天过一遍' },
]);

export const ENERGY_MAX = 100;
/** 精力低于它时，当天突发事件概率整体上浮 */
export const ENERGY_DANGER = 20;
export const LOW_ENERGY_EVENT_MULTIPLIER = 1.35;
/** 同一门课一天内重复上，收益按次递减 */
export const REPEAT_DECAY = 0.5;

// ===========================================================================
// 突发事件库
//
// curve: { base, peak } —— 18 线时概率 base，1 线时 peak，中间指数插值。
// guards: [{ attr, pivot, factor }] —— 属性每高出 pivot 50 点，概率乘一次 factor
//   （factor < 1 是保护；属性低于 pivot 时反向放大）。这是「加权概率」的核心。
// shieldable —— 公关护盾（买断黑料）期间概率 ×0.15。
// options —— 用户可选的处理方式；不处理走 autoEffects。
// ===========================================================================

export const EVENT_KINDS = Object.freeze({
    scandal: { id: 'scandal', label: '舆情危机', tone: 'danger' },
    chance: { id: 'chance', label: '机遇', tone: 'success' },
    social: { id: 'social', label: '交际', tone: 'info' },
    industry: { id: 'industry', label: '行业', tone: 'warn' },
    hidden: { id: 'hidden', label: '隐藏', tone: 'violet' },
});

export const EVENT_DEFS = Object.freeze([
    // ---- 舆情危机 ----
    {
        id: 'all-net-black', kind: 'scandal', title: '被全网黑',
        desc: '一段被恶意剪辑的视频突然爆了，评论区全线沦陷。',
        curve: { base: 0.05, peak: 0.80 },
        guards: [
            { attr: 'resilience', pivot: 55, factor: 0.55 },
            { attr: 'network', pivot: 55, factor: 0.72 },
            { attr: 'empathy', pivot: 55, factor: 0.85 },
        ],
        shieldable: true, cooldownDays: 6,
        options: [
            { id: 'respond', label: '直播正面回应', effects: { attrs: { resilience: 2, fame: -2 }, note: '有人被你圈粉，也有人等着抓你话柄' } },
            { id: 'cold', label: '冷处理', effects: { attrs: { fame: -5, resilience: 1 }, note: '热度慢慢过去，但词条挂了三天' } },
            { id: 'pr', label: '公关压热搜', costKind: 'pr', effects: { attrs: { fame: -1 }, note: '钱花出去了，词条悄悄沉了' } },
        ],
        autoEffects: { attrs: { fame: -6, resilience: -2 } },
    },
    {
        id: 'romance-leak', kind: 'scandal', title: '恋情传闻曝光',
        desc: '代拍拍到你和某人深夜同框，配文写得有鼻子有眼。',
        curve: { base: 0.03, peak: 0.45 },
        guards: [{ attr: 'resilience', pivot: 50, factor: 0.7 }, { attr: 'network', pivot: 60, factor: 0.8 }],
        shieldable: true, cooldownDays: 10,
        options: [
            { id: 'deny', label: '否认三连', effects: { attrs: { fame: -2 }, note: '信的人一半，不信的人一半' } },
            { id: 'silent', label: '不回应', effects: { attrs: { fame: 2, resilience: -1 }, note: '吃了三天流量，粉丝心里发慌' } },
            { id: 'pr', label: '买断物料', costKind: 'pr', effects: { note: '原图和底片都收回来了' } },
        ],
        autoEffects: { attrs: { fame: -1 } },
    },
    {
        id: 'set-conflict-leak', kind: 'scandal', title: '剧组冲突被泄露',
        desc: '有场务把你在片场和导演争执的片段卖给了营销号。',
        curve: { base: 0.04, peak: 0.35 },
        guards: [{ attr: 'network', pivot: 55, factor: 0.65 }, { attr: 'empathy', pivot: 50, factor: 0.85 }],
        shieldable: true, cooldownDays: 8, requiresProject: true,
        options: [
            { id: 'apologize', label: '公开道歉', effects: { attrs: { empathy: 1, fame: -3 }, note: '姿态放低，风波渐平' } },
            { id: 'explain', label: '晒工作记录自证', effects: { attrs: { resilience: 1, fame: -1 }, note: '懂行的人站你，路人各信各的' } },
            { id: 'pr', label: '公关处理', costKind: 'pr', effects: { note: '营销号连夜删稿' } },
        ],
        autoEffects: { attrs: { fame: -4, network: -1 } },
    },
    {
        id: 'anti-rumor', kind: 'scandal', title: '黑粉造谣学历',
        desc: '一张 P 过的成绩单在超话里传疯了。',
        curve: { base: 0.05, peak: 0.5 },
        guards: [{ attr: 'resilience', pivot: 50, factor: 0.6 }],
        shieldable: true, cooldownDays: 7,
        options: [
            { id: 'lawyer', label: '发律师函', effects: { attrs: { resilience: 2, fame: 1 }, note: '造谣号注销跑路' } },
            { id: 'ignore', label: '随它去', effects: { attrs: { fame: -2 }, note: '谣言挂在词条相关里落了灰' } },
        ],
        autoEffects: { attrs: { fame: -3 } },
    },
    {
        id: 'stan-backfire', kind: 'scandal', title: '站姐脱粉回踩',
        desc: '跟了你三年的大站宣布关站，长文里全是「意难平」。',
        curve: { base: 0.02, peak: 0.4 },
        guards: [{ attr: 'empathy', pivot: 55, factor: 0.6 }],
        shieldable: false, cooldownDays: 12, minFameBase: 25,
        options: [
            { id: 'thank', label: '私下致谢告别', effects: { attrs: { empathy: 2, fame: -1 }, note: '体面收场，圈内口碑加分' } },
            { id: 'nothing', label: '当没看见', effects: { attrs: { fame: -3 }, note: '粉圈内战打了一星期' } },
        ],
        autoEffects: { attrs: { fame: -3 } },
    },
    {
        id: 'tax-storm', kind: 'hidden', title: '税务风波（隐藏）',
        desc: '一封匿名举报信送到了监管部门。工作室的账，经得起查吗？',
        curve: { base: 0.002, peak: 0.06 },
        guards: [{ attr: 'network', pivot: 70, factor: 0.6 }],
        shieldable: false, once: true, minFameBase: 55,
        options: [
            { id: 'audit', label: '主动自查补税', costKind: 'bigMoney', effects: { attrs: { fame: -8, resilience: 3 }, note: '伤筋动骨，但保住了职业生涯' } },
            { id: 'gamble', label: '赌它查不到', effects: { attrs: {}, gamble: { chance: 0.5, win: { note: '风声过去了' }, lose: { attrs: { fame: -40, network: -20 }, note: '全网封禁边缘走了一遭' } } } },
        ],
        autoEffects: { attrs: { fame: -10 } },
    },
    // ---- 机遇 ----
    {
        id: 'director-notice', kind: 'chance', title: '大导演注意到你',
        desc: '你上次的片段被一位以严苛出名的导演转发了。',
        curve: { base: 0.02, peak: 0.18 },
        guards: [{ attr: 'acting', pivot: 50, factor: 1.5 }, { attr: 'camera', pivot: 50, factor: 1.25 }],
        cooldownDays: 15,
        options: [
            { id: 'visit', label: '递作品集拜访', effects: { attrs: { network: 3, acting: 1 }, note: '他说了句「下次组里见」' } },
            { id: 'humble', label: '转发致谢就好', effects: { attrs: { fame: 2 }, note: '体面而克制' } },
        ],
        autoEffects: { attrs: { fame: 1 } },
    },
    {
        id: 'brand-offer', kind: 'chance', title: '品牌代言邀约',
        desc: '一个调性不错的品牌想签你做季度代言。',
        curve: { base: 0.01, peak: 0.35 },
        guards: [{ attr: 'fame', pivot: 40, factor: 1.6 }],
        cooldownDays: 20, minFameBase: 20, pay: 'brand',
        options: [
            { id: 'sign', label: '签约', effects: { attrs: { fame: 3 }, income: 'brand', note: '海报挂进了商场中庭' } },
            { id: 'decline', label: '婉拒', effects: { attrs: { network: 1 }, note: '品牌方记住了你的谨慎' } },
        ],
        autoEffects: { attrs: {} },
    },
    {
        id: 'variety-invite', kind: 'chance', title: '热门综艺递话',
        desc: '一档播了四季的综艺想请你做飞行嘉宾。',
        curve: { base: 0.02, peak: 0.4 },
        guards: [{ attr: 'empathy', pivot: 50, factor: 1.3 }],
        cooldownDays: 12, minFameBase: 15, pay: 'variety',
        options: [
            { id: 'go', label: '接下通告', effects: { attrs: { fame: 4, resilience: -1 }, income: 'variety', note: '播出当晚上了三个词条' } },
            { id: 'pass', label: '推掉专心拍戏', effects: { attrs: { acting: 1 }, note: '剧组的人说你沉得住气' } },
        ],
        autoEffects: { attrs: {} },
    },
    {
        id: 'hot-praise', kind: 'chance', title: '路人好评发酵',
        desc: '你一段三年前的舞台被考古了，弹幕全在问「这是谁」。',
        curve: { base: 0.06, peak: 0.25 },
        guards: [{ attr: 'acting', pivot: 45, factor: 1.3 }],
        cooldownDays: 9,
        autoEffects: { attrs: { fame: 3 } },
    },
    {
        id: 'senior-support', kind: 'hidden', title: '老戏骨的提携（隐藏）',
        desc: '一位从不带新人的老前辈，突然让助理来要你的联系方式。',
        curve: { base: 0.008, peak: 0.05 },
        guards: [{ attr: 'acting', pivot: 65, factor: 2.0 }, { attr: 'empathy', pivot: 60, factor: 1.5 }],
        once: true,
        options: [
            { id: 'learn', label: '登门求教', effects: { attrs: { acting: 4, diction: 2, network: 3 }, note: '他只说了一句：戏比天大' } },
        ],
        autoEffects: { attrs: { acting: 2 } },
    },
    // ---- 行业 ----
    {
        id: 'industry-winter', kind: 'industry', title: '行业寒冬',
        desc: '平台集体缩减片单，今年的组讯少了一半。',
        curve: { base: 0.03, peak: 0.03 },
        cooldownDays: 45,
        autoEffects: { attrs: { resilience: -1 }, note: '接下来一段时间试镜更难了' },
    },
    {
        id: 'pay-limit', kind: 'industry', title: '平台限薪令',
        desc: '新政策出台，头部片酬直接腰斩。',
        curve: { base: 0.01, peak: 0.12 },
        cooldownDays: 60, minFameBase: 45,
        autoEffects: { attrs: {}, note: '片酬基准下调了一段时间' },
    },
    {
        id: 'genre-wave', kind: 'industry', title: '题材风口',
        desc: '悬疑短剧突然爆了，全行业都在攒同类项目。',
        curve: { base: 0.04, peak: 0.08 },
        cooldownDays: 30,
        autoEffects: { attrs: {}, note: '近期该题材试镜成功率上升' },
    },
    // ---- 交际 ----
    {
        id: 'npc-encounter', kind: 'social', title: '有人想认识你',
        desc: '经纪人转来一条口信。',
        curve: { base: 0.10, peak: 0.30 },
        guards: [{ attr: 'network', pivot: 40, factor: 1.25 }],
        cooldownDays: 2, isEncounter: true,
        autoEffects: { attrs: {} },
    },
    {
        id: 'set-dinner', kind: 'social', title: '剧组聚餐',
        desc: '杀青宴定在今晚，去不去？',
        curve: { base: 0.05, peak: 0.12 },
        requiresProject: true, cooldownDays: 6,
        options: [
            { id: 'go', label: '去，多敬两杯', effects: { attrs: { network: 2, empathy: 1 }, energy: -15, note: '导演拍着你肩膀说了些掏心窝的话' } },
            { id: 'skip', label: '推了，回家背词', effects: { attrs: { diction: 1 }, note: '安静的夜晚属于剧本' } },
        ],
        autoEffects: { attrs: {} },
    },
]);

// ===========================================================================
// 奖项预设（段锚点）—— 用户可随机、可编辑、可自定义得奖条件
// ===========================================================================

export const AWARD_PRESETS = Object.freeze([
    {
        id: 'award-newcomer', name: '新人风采奖', cycleDays: 90,
        desc: '面向 10 线以下新人的年度四季评选',
        conditions: { maxTier: 10, minFame: 12, minWorks: 1, minCraft: 40 },
        reward: { fame: 5, money: 20000, honor: '新人风采奖' },
        competitive: true, fieldStrength: 45,
    },
    {
        id: 'award-audience', name: '观众选择奖', cycleDays: 120,
        desc: '纯人气投票，粉丝的战场',
        conditions: { minFame: 30, minWorks: 1 },
        reward: { fame: 7, money: 50000, honor: '观众选择奖' },
        competitive: true, fieldStrength: 60,
    },
    {
        id: 'award-drama-guild', name: '剧协表演大赏', cycleDays: 150,
        desc: '行业内部评审，看的是真演技',
        conditions: { minCraft: 65, minWorks: 2 },
        reward: { fame: 8, money: 80000, honor: '剧协表演大赏' },
        competitive: true, fieldStrength: 72,
    },
    {
        id: 'award-starnight', name: '星辰之夜盛典', cycleDays: 180,
        desc: '半年一届的全行业红毯夜',
        conditions: { minFame: 50, minWorks: 2, minCraft: 55 },
        reward: { fame: 10, money: 150000, honor: '星辰之夜·年度演员' },
        competitive: true, fieldStrength: 80,
    },
    {
        id: 'award-goldwood', name: '金梧桐奖', cycleDays: 360,
        desc: '这个世界最重的表演奖，拿到即是加冕',
        conditions: { minFame: 70, minWorks: 3, minCraft: 78 },
        reward: { fame: 15, money: 500000, honor: '金梧桐最佳演员' },
        competitive: true, fieldStrength: 90,
    },
]);

/** 随机奖项时可抽的名字与条件微扰范围 */
export const AWARD_NAME_POOL = Object.freeze([
    '青芒奖', '白鹭奖', '流光大赏', '月桂之夜', '燃星盛典', '春潮影像展', '仲夏剧幕奖', '琥珀评审团奖',
]);

// ===========================================================================
// 世界观节日（点锚点）—— 演员世界的固定日子
// ===========================================================================

export const FESTIVAL_PRESETS = Object.freeze([
    { id: 'fest-actor-vote', name: '演员评选日', everyDays: 60, desc: '全行业公开投票，给每条线排座次' },
    { id: 'fest-award-announce', name: '奖项公布日', everyDays: 90, desc: '各大奖项提名与归属集中揭晓' },
    { id: 'fest-film-week', name: '春晖电影节', everyDays: 120, desc: '红毯、首映与场刊评分' },
    { id: 'fest-fan-carnival', name: '影迷嘉年华', everyDays: 45, desc: '粉丝节，见面会扎堆的一天' },
    { id: 'fest-platform-pitch', name: '平台招商会', everyDays: 75, desc: '明年的片单在这一天定盘子' },
]);

// ===========================================================================
// NPC 素材池 —— 类 MBTI 拼装（JS 确定性生成，不调 API）
// ===========================================================================

export const NPC_POOLS = Object.freeze({
    surnames: Object.freeze([
        '沈', '顾', '陆', '江', '苏', '林', '傅', '祁', '温', '霍', '许', '纪', '闻', '裴', '岑', '容',
        '厉', '晏', '池', '桑', '简', '黎', '骆', '喻', '虞', '邵', '柯', '蔺', '穆', '禹', '孟', '尹',
        '秦', '席', '阮', '柏', '雷', '关', '甘', '祝',
    ]),
    givens: Object.freeze([
        '砚', '之遥', '青临', '晚舟', '斯年', '未央', '既白', '疏影', '照野', '明微', '見山', '知许',
        '归鸿', '折柳', '南絮', '亦安', '徵羽', '与晴', '书淮', '若疏', '沉璧', '临深', '観棋', '照雪',
        '衔月', '拾伍', '成蹊', '望舒', '扶摇', '既明', '朝暮', '雾时', '星阑', '迟迟', '暮野', '汀兰',
        '一苇', '经年', '故渊', '闻笛', '栖迟', '云亭', '嘉树', '清晏', '兰因', '慢慢', '野聿', '声声',
        '眠洲', '揽星', '退之', '灼灼', '既望', '澹台', '晚吟', '定风', '知遇', '未晞', '青梧', '雪满',
    ]),
    occupations: Object.freeze([
        { id: 'director', label: '导演', status: '资深', weight: 3 },
        { id: 'top-director', label: '顶级导演', status: '顶级', weight: 1 },
        { id: 'producer', label: '制片人', status: '资深', weight: 3 },
        { id: 'agent', label: '经纪人', status: '业内', weight: 3 },
        { id: 'writer', label: '编剧', status: '资深', weight: 2 },
        { id: 'co-actor-top', label: '一线演员', status: '顶级', weight: 1 },
        { id: 'co-actor', label: '同剧演员', status: '同行', weight: 4 },
        { id: 'newbie-actor', label: '新人演员', status: '新人', weight: 3 },
        { id: 'casting', label: '选角导演', status: '业内', weight: 2 },
        { id: 'variety-pd', label: '综艺 PD', status: '业内', weight: 2 },
        { id: 'reporter', label: '娱记', status: '圈边', weight: 2 },
        { id: 'fan-leader', label: '大粉站姐', status: '圈边', weight: 2 },
        { id: 'brand-pr', label: '品牌公关', status: '商务', weight: 2 },
        { id: 'makeup', label: '首席化妆师', status: '剧组', weight: 2 },
        { id: 'stunt', label: '武替', status: '剧组', weight: 1 },
        { id: 'investor', label: '影视投资人', status: '资方', weight: 1 },
        { id: 'exec', label: '平台高管', status: '资方', weight: 1 },
        { id: 'acting-coach', label: '表演指导', status: '资深', weight: 2 },
    ]),
    hiddenOccupations: Object.freeze([
        { id: 'shadow-broker', label: '身份成谜的掮客', status: '暗面' },
        { id: 'retired-legend', label: '息影多年的传奇', status: '传说' },
    ]),
    mbti: Object.freeze([
        'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
        'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
    ]),
    traits: Object.freeze([
        '嘴硬心软', '记仇但只记三天', '对数字过目不忘', '习惯性打圆场', '毒舌但准', '慢热到冰点',
        '永远提前十五分钟', '包里常备三种胃药', '爱在监视器后面自言自语', '只在深夜回消息',
        '把合同倒背如流', '会记得每个人的忌口', '不笑的时候很凶', '收藏了一抽屉票根',
        '对烂剧本零容忍', '八卦绝缘体', '讲话喜欢打比方', '给谁都留退路', '输不起棋但输得起戏',
        '手机永远静音', '习惯用左手比划走位', '闻得出谁在敷衍', '在片场养了只猫', '雨天心情格外好',
        '背台词要走来走去', '对新人格外耐心', '从不解释自己的决定', '会突然请全组喝奶茶',
        '把「随便」当口头禅但其实很挑', '相信运气是实力的一部分',
    ]),
    quirks: Object.freeze([
        '随身带一支旧钢笔', '开机前必须喝半杯温水', '只坐固定的那把折叠椅', '给重要的戏写小纸条',
        '收工后独自散步半小时', '口袋里有颗不吃的糖', '用胶片机拍每个杀青日', '给每个角色起小名',
        '在剧本空白处画小人', '记得所有人的生日却从不过自己的', '手腕上缠一根褪色红绳',
        '吃饭永远坐背对门的位置', '下雨天会关掉所有消息', '习惯把「没事」说两遍',
        '在车里备一套黑西装', '存了很多没发出去的道歉短信', '耳机里循环同一首老歌',
        '会在深夜给自己写工作复盘', '藏着一张没人见过的老照片', '给流浪猫留了片场的一角',
    ]),
    agendas: Object.freeze([
        '在找一个能托付十年的合作者', '想翻拍压箱底的老剧本', '在攒一部自己说了算的戏',
        '想捧红一个没背景的新人', '在等一个向旧东家证明的机会', '打算明年就退圈但没人信',
        '想把这行的规矩改一改', '在替某个人还一份旧人情', '收集有潜力的年轻演员名单',
        '想做一部不赚钱但体面的片子', '在观察谁值得引荐给「上面」', '需要一个能扛收视的脸',
        '想找人合伙开表演工作室', '在写一本揭露行业的书', '欠了一屁股人情债正在慢慢还',
        '只想安安静静把手艺传下去',
    ]),
    attitudes: Object.freeze([
        { id: 'warm', label: '欣赏你', bias: 8 },
        { id: 'curious', label: '对你好奇', bias: 4 },
        { id: 'neutral', label: '公事公办', bias: 0 },
        { id: 'wary', label: '对你存疑', bias: -4 },
        { id: 'cold', label: '不看好你', bias: -8 },
    ]),
});

/** 每个档案键固定生成 30 个 NPC，其中 2 个隐藏；每档默认启用前 15 个 */
export const NPC_ROSTER_SIZE = 30;
export const NPC_HIDDEN_COUNT = 2;
export const NPC_DEFAULT_ACTIVE = 15;

// ===========================================================================
// 项目 / 剧本
// ===========================================================================

export const PROJECT_TYPES = Object.freeze([
    { id: 'drama', label: '电视剧', scenes: 6, payFactor: 1.0 },
    { id: 'film', label: '电影', scenes: 5, payFactor: 1.6 },
    { id: 'stage', label: '舞台剧', scenes: 4, payFactor: 0.7 },
    { id: 'short', label: '短剧', scenes: 3, payFactor: 0.5 },
]);

export const ROLE_LEVELS = Object.freeze([
    { id: 'lead', label: '主角', craftGate: 62, fameGate: 45, payFactor: 2.2 },
    { id: 'second', label: '二番', craftGate: 52, fameGate: 25, payFactor: 1.4 },
    { id: 'support', label: '重要配角', craftGate: 40, fameGate: 10, payFactor: 1.0 },
    { id: 'minor', label: '小配角', craftGate: 25, fameGate: 0, payFactor: 0.55 },
    { id: 'extra', label: '龙套', craftGate: 0, fameGate: 0, payFactor: 0.25 },
]);

/** 演出评级（resolveContest grade → 展示） */
export const PERFORM_GRADES = Object.freeze({
    'miracle-win': { label: '封神现场', factor: 1.5 },
    'decisive-win': { label: '稳定发挥', factor: 1.2 },
    'close-win': { label: '有惊无险', factor: 1.0 },
    'close-loss': { label: '状态失准', factor: 0.7 },
    'heavy-loss': { label: '大型翻车', factor: 0.4 },
    collapse: { label: '当场崩盘', factor: 0.3 },
});

// ===========================================================================
// 阶段结算 —— 多块串行生成（类 cursor 子任务，不可重 roll）
// ===========================================================================

export const SETTLEMENT_BLOCKS = Object.freeze([
    { id: 'recap', label: '阶段回顾', type: 'text', desc: '这段路是怎么走过来的' },
    { id: 'stats', label: '数值结算', type: 'json', desc: '九维属性的增减与理由' },
    { id: 'relations', label: '人脉与关系', type: 'json', desc: '谁靠近了，谁远了' },
    { id: 'publicity', label: '舆论与形象', type: 'text', desc: '大众此刻怎么看你' },
    { id: 'outlook', label: '新阶段展望', type: 'text', desc: '下一线的路怎么走' },
]);

/** 阶段结算里 AI 建议的属性变化上限（防失控） */
export const SETTLEMENT_DELTA_CAP = 8;
/** 快进时 AI 建议的属性变化上限 */
export const FAST_FORWARD_DELTA_CAP = 6;

// ===========================================================================
// 页面 tab
// ===========================================================================

export const TABS = Object.freeze([
    { id: 'today', label: '今日', icon: 'sun' },
    { id: 'schedule', label: '日程', icon: 'clock' },
    { id: 'work', label: '剧组', icon: 'clapper' },
    { id: 'circle', label: '圈子', icon: 'users' },
    { id: 'me', label: '我的', icon: 'me' },
]);
