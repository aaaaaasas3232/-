/**
 * 灯塔 · 提示词卡片目录
 *
 * ── 为什么要有这一层 ──────────────────────────────────────────────
 *
 * 用户要求「也要有类似 murmur 的回复提示词管理页，方便游玩」。murmur 那套的
 * 核心不是 UI，是**把一段 system prompt 拆成若干张能单独开关、单独改、
 * 能拖顺序的卡**。所以这里先把「有哪几张卡、各自默认写什么、进哪几个场景」
 * 定义成数据，`prompt-builder` 只负责按场景挑卡 + 拼接。
 *
 * 这样做的直接好处：**管理页看到的就是发出去的**。
 * 卡列表、开关状态、顺序、正文都是同一份数据的两个消费方
 * （一个渲染成 UI，一个拼成字符串），不可能分叉。
 *
 * ── locked 是什么意思 ─────────────────────────────────────────────
 *
 * `locked: true` 的卡不能关，只能改正文。目前有三张：角色、世界观、货币。
 * 关掉它们这个 App 就没有存在意义了 —— 生成出来的会是一堆和世界观无关的
 * 通用招聘信息，而用户多半不会把这个后果和「我上周关了一张卡」联系起来。
 *
 * ── 占位符 ────────────────────────────────────────────────────────
 *
 * 正文里可以写 `{{世界观}}` `{{货币}}` `{{我}}` `{{职位}}` 这些，
 * 拼装时按当前上下文替换。用中文占位符是刻意的 —— 这些卡是给用户改的，
 * `{{worldSummary}}` 对他没有意义。
 */

/** 场景 id。每张卡声明自己进哪几个场景。 */
export const SCENES = Object.freeze({
    feed: 'feed',              // 生成职位列表
    detail: 'detail',          // 生成职位详情
    recruiter: 'recruiter',    // 生成 HR 人设
    talk: 'talk',              // 面试对话
    theater: 'theater',        // 每日小剧场
    digest: 'digest',          // 当天工作梗概
});

export const SCENE_LABELS = Object.freeze({
    feed: '职位列表',
    detail: '职位详情',
    recruiter: 'HR 人设',
    talk: '面试对话',
    theater: '小剧场',
    digest: '当天梗概',
});

/** 卡片分组。分组顺序 = 管理页里的展示顺序。 */
export const CARD_GROUPS = Object.freeze([
    { id: 'base', label: '底座', desc: '每一次生成都带上，关不掉' },
    { id: 'material', label: '素材', desc: '从世界观和 prompt 库里挑的补充材料' },
    { id: 'style', label: '写法', desc: '决定生成出来是什么调子' },
    { id: 'rule', label: '规则', desc: '录用尺度、钱和表现的关系' },
]);

const ALL = Object.values(SCENES);

/**
 * 卡片目录。
 *
 * ★ `id` 发布之后**不能改** —— 用户的开关和改动按 id 存盘，改了等于清空他的设置。
 */
export const PROMPT_CARDS = Object.freeze([
    {
        id: 'role',
        group: 'base',
        title: '你的角色',
        desc: '告诉 AI 它在为一个求职软件干活',
        locked: true,
        scenes: ALL,
        text:
            '你在为一个叫「灯塔」的求职软件生成内容。这个软件活在下面这个世界里，'
            + '它挂出来的每一个职位、每一家用人单位、每一段工作片段，'
            + '都必须是这个世界里真的会有的东西。\n'
            + '不要出现现实世界的公司名、现实地名、现实货币、现实法规。',
    },
    {
        id: 'world',
        group: 'base',
        title: '世界观',
        desc: '这个世界是什么样的。关掉它生成的东西就和你的设定无关了',
        locked: true,
        scenes: ALL,
        text: '{{世界观}}',
    },
    {
        id: 'currency',
        group: 'base',
        title: '资金映射',
        desc: '规定用什么钱结算。写得不硬 AI 会自己冒出「元」',
        locked: true,
        scenes: ALL,
        text:
            '这个世界的通用货币叫「{{货币}}」。\n'
            + '- 所有金额都用「{{货币}}」计价，只给数字，不要带单位符号，不要写「元」「块」「$」。\n'
            + '- 薪资要符合这个世界的物价：普通岗位的月薪应该够一个人过日子，稀缺岗位可以是它的好几倍。\n'
            + '- 同一批职位里薪资要拉开差距，不要全是一个数。',
    },

    {
        id: 'me',
        group: 'material',
        title: '我是谁',
        desc: '把你的人设发给 AI，面试和小剧场里的「你」才像你',
        scenes: [SCENES.recruiter, SCENES.talk, SCENES.theater, SCENES.digest, SCENES.feed],
        text: '求职的人（也就是用户本人）：\n{{我}}',
    },
    {
        id: 'clips',
        group: 'material',
        title: '世界观夹子',
        desc: '首次配置里勾选的那些碎设定',
        scenes: ALL,
        text: '{{夹子}}',
    },
    {
        id: 'library',
        group: 'material',
        title: '附加提示词',
        desc: '从 prompt 库里挑的条目',
        scenes: ALL,
        text: '{{附加提示词}}',
    },
    {
        id: 'aim',
        group: 'material',
        title: '我想找什么工作',
        desc: '首次配置里写的求职方向',
        scenes: [SCENES.feed, SCENES.detail, SCENES.recruiter],
        text: '{{求职方向}}',
    },

    {
        id: 'market-style',
        group: 'style',
        title: '招聘板的写法',
        desc: '决定职位列表读起来像不像真的',
        scenes: [SCENES.feed, SCENES.detail],
        text:
            '- 职位名要具体，不要「优质岗位」「诚聘英才」这种；一看就知道是哪个世界的活\n'
            + '- 用人单位的名字要像这个世界里真的存在的机构、商号、门派、公会\n'
            + '- 一句话简介写得像招人的人自己写的，不要「薪资优厚，前景广阔」这类空话\n'
            + '- 同一批里要有体面的也有辛苦的，不要全是好活',
    },
    {
        id: 'hr-style',
        group: 'style',
        title: 'HR 怎么说话',
        desc: '面试对话的调子',
        scenes: [SCENES.recruiter, SCENES.talk],
        text:
            '- 你是招人的那一方，不是客服。可以挑剔、可以嫌弃、可以急着招到人\n'
            + '- 一次只说两三句，像在聊天软件里打字，不要长篇大论\n'
            + '- 该问的要问：他会什么、以前干过什么、什么时候能到岗\n'
            + '- 不要一上来就录用，也不要问了一句就赶人\n'
            + '- 不要用现实世界的招聘黑话（「赋能」「闭环」这类），除非这个世界真的有',
    },
    {
        id: 'theater-style',
        group: 'style',
        title: '小剧场怎么写',
        desc: '每天那一小段的写法',
        scenes: [SCENES.theater],
        text:
            '- 写这一天上班时发生的一件具体的事，不要写「充实的一天」这种总结\n'
            + '- 每个人说话要像他自己，性格差异要能从台词里看出来\n'
            + '- 旁白只写看得见的东西，不要替角色解释心理活动\n'
            + '- 可以平淡，可以出岔子，不用每天都有戏剧性\n'
            + '- speaker 只能用出场人物里列出的名字，不要凭空加人',
    },
    {
        id: 'theater-cast',
        group: 'style',
        title: '同事与不对付的人',
        desc: '决定这些人在小剧场里怎么出现',
        scenes: [SCENES.theater, SCENES.digest],
        text:
            '- 同事不一定都友好，但他们和「我」在同一条船上\n'
            + '- 标了「不对付」的人要真的制造摩擦：抢功、甩锅、当众下不来台、阴阳怪气\n'
            + '- 不要让不对付的人每一场都出现，也不要让他们无缘无故和解\n'
            + '- 没被列进来的人不要出场',
    },
    {
        id: 'digest-style',
        group: 'style',
        title: '当天梗概怎么写',
        desc: '这段会被后面几天的小剧场读到，写法直接影响连续性',
        scenes: [SCENES.digest],
        text:
            '- 两三句，写「发生过什么」，不要写「这段写得怎么样」\n'
            + '- 第一句说事：做了什么、和谁、结果如何\n'
            + '- 第二句说人：谁的态度变了、谁欠了谁一个人情、谁记恨上了\n'
            + '- 有没解决的事要点出来，那是明天的引子\n'
            + '- 不要复述台词原文',
    },

    {
        id: 'hire-rule',
        group: 'rule',
        title: '录用尺度',
        desc: '决定 AI 什么时候点头、什么时候赶人',
        scenes: [SCENES.talk],
        text:
            '录用判断：\n'
            + '- 聊够三四个来回再下结论，除非对方明显在乱说\n'
            + '- 他答得对不对路、态度行不行，比「有没有经验」更重要\n'
            + '- 这个岗位越稀缺、要求越高，越该挑剔\n'
            + '- 决定了就明说，不要吊着。拒绝要给一句真实的理由，别只说「不合适」\n'
            + '- 拒绝不是坏结局，被拒之后他还可以去投别家',
    },
    {
        id: 'pay-rule',
        group: 'rule',
        title: '表现与钱',
        desc: '小剧场里的表现评级怎么给',
        scenes: [SCENES.theater],
        text:
            '当天表现评级：\n'
            + '- 按这一天他实际做成了什么来给，不要因为剧情好看就给高\n'
            + '- 大部分日子应该是「正常」。天天出彩不真实，天天搞砸也不真实\n'
            + '- 出岔子、被批评、和人吵起来 → 「不太行」甚至「搞砸了」\n'
            + '- 只有真的解决了麻烦、被明确认可，才给「很出彩」\n'
            + '- 额外奖金只在剧情里真的有人给钱时才写，平时留 0',
    },
]);

const BY_ID = new Map(PROMPT_CARDS.map((c) => [c.id, c]));

export function getCard(id) {
    return BY_ID.get(String(id)) || null;
}

/**
 * 把默认目录和用户改动合成「当前实际生效的卡列表」。
 *
 * @param {object} overrides  `{ [id]: { active?, text? } }`，只存改过的
 * @param {string[]} order    用户拖出来的顺序，没出现的按默认顺序排在后面
 * @returns {Array} 卡片 + `active` / `text` / `edited` 三个运行时字段
 */
export function resolveCards(overrides = {}, order = []) {
    const ov = overrides || {};
    const list = PROMPT_CARDS.map((card) => {
        const patch = ov[card.id] || {};
        const text = typeof patch.text === 'string' ? patch.text : card.text;
        return {
            ...card,
            text,
            active: card.locked ? true : patch.active !== false,
            edited: typeof patch.text === 'string' && patch.text !== card.text,
        };
    });

    if (!Array.isArray(order) || !order.length) return list;

    const rank = new Map(order.map((id, i) => [String(id), i]));
    return list.slice().sort((a, b) => {
        const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
        const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return PROMPT_CARDS.indexOf(getCard(a.id)) - PROMPT_CARDS.indexOf(getCard(b.id));
    });
}

/** 挑出某个场景要用的卡（已启用、正文非空） */
export function cardsForScene(cards, scene) {
    return (cards || []).filter((c) => c.active && c.scenes.includes(scene));
}
