/**
 * 氧气 · 提示词组装（唯一真相）
 *
 * 每个 build* 都走 `composeContext()`，返回 `{ text, parts, stats }`：
 *   text   发给 AI 的那一份
 *   parts  「提示词」页渲染的那一份
 * 是同一次调用的两个返回字段，物理上不可能不一致。
 *
 * ── 标签优先是产品核心 ────────────────────────────────────────────
 * 广场列表只生成「作者 + 标签 + 类型 + 内容线索」，正文在用户点击时才展开。
 * stub 里的 seed（内容线索）只做展开正文的接力棒，永远不渲染给用户。
 *
 * ── 小听 ──────────────────────────────────────────────────────────
 * 冥想空间三步链与小听对话的 prompt 也在这里。她的隐藏人设对用户可见
 * （提示词透明页），对「她」保密的只是身份，不是机制。
 *
 * ★ 本文件是纯函数：不读 window、不读 store。node 测试直接 import。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import {
    COMMENT_PAGE, FEED_SIZE, HOT_SIZE, JSON_RULE, SHAPE_IDS, TERM_POST_SIZE,
} from '../constants.js';
import { asArray, truncate } from '../utils.js';

const composer = createContextComposer({ namespace: 'blog' });

export { composer };

function part(id, title, content, opts = {}) {
    return {
        id,
        title,
        content: String(content || '').trim(),
        tag: opts.tag || title,
        active: opts.active !== false,
        locked: opts.locked === true,
        source: opts.source || '',
        group: opts.group || '',
    };
}

// ============================================================
// 世界观底座 —— 所有社交生成都以它开头
// ============================================================

/**
 * @param {object} ctx
 * @param {object}   ctx.identity        world-context.readIdentity() 快照
 * @param {string}   ctx.summary         世界观简介
 * @param {object[]} ctx.clips           选中的夹子
 * @param {object[]} ctx.prompts         选中的 prompt 库条目
 * @param {string[]} ctx.interests       用户关注的话题
 * @param {object[]} [ctx.influenceParts] socialInfluences.collect 的结果（已是 part 形状）
 */
export function buildWorldParts(ctx = {}) {
    const { identity = {}, clips = [], prompts = [], interests = [], summary = '' } = ctx;

    const out = [];

    out.push(part('role', '你的角色',
        `你在为一个叫「氧气」的博客软件生成内容。它活在下面这个世界里：`
        + `每一条帖子、每一个作者、每一条评论，都必须是这个世界里真实会出现的。`
        + `不要出现现实世界的平台名、真实明星、品牌和地名。\n`
        + `氧气的规矩很特别：信息流里只显示发帖人打的标签，看不到正文 —— `
        + `所以标签是帖子的门面，要打得真实、有性格；正文只有点进来的人才读得到。`
        + `不要色情、不要擦边，也不要把帖子写成带货。`,
        { locked: true, source: '内置' }));

    out.push(part('world', `世界观：${identity.worldName || '未命名'}`,
        `这个世界叫「${identity.worldName || '未命名'}」。\n`
        + (summary || '（这个世界观还没写简介，请按名字合理推测，但不要引入现实世界的平台和人名。）'),
        { locked: true, tag: '世界观', source: 'nook 世界观' }));

    const clipList = asArray(clips).filter((c) => c && c.content);
    if (clipList.length) {
        out.push(part('clips', '世界观夹子',
            clipList.map((c) => `【${c.title}】\n${c.content}`).join('\n\n'),
            { source: 'nook 夹子' }));
    }

    const promptList = asArray(prompts).filter((p) => p && p.content);
    if (promptList.length) {
        out.push(part('prompts', '附加提示词',
            promptList.map((p) => `【${p.title}】\n${p.content}`).join('\n\n'),
            { source: 'prompt 库' }));
    }

    const interestList = asArray(interests).map((t) => String(t || '').trim()).filter(Boolean);
    if (interestList.length) {
        out.push(part('interests', '用户关注的话题', interestList.join('、'), { source: '首次配置' }));
    }

    for (const extra of asArray(ctx.influenceParts)) {
        if (extra && extra.content) out.push({ ...extra });
    }

    return out;
}

// ============================================================
// 广场列表（只出标签级 stub，不出正文）
// ============================================================

const FEED_SHAPE = `{
  "posts": [
    {
      "authorName": "发帖人名字，2~8 字，像这个世界的网名",
      "type": "long | short | murmur（长文 / 短文 / 碎碎念）",
      "tags": ["1~4 个标签，每个 2~6 字。标签是帖子唯一的门面，要有性格：有具体名词、有情绪词、有只有本人才懂的暗号"],
      "seed": "这条帖子在写什么的内部线索，12~30 字。用户永远看不到它，之后展开正文时才用",
      "heat": 数字（这条帖子的热度 1~1000，按作者体量合理给）
    }
  ]
}`;

/**
 * 生成一批广场 stub。只出标签不出正文 —— 正文等用户点进去再生成。
 * @param {object} ctx 世界底座 + { knownAuthors:[{name}], excludeSeeds:[], size }
 */
export function buildFeedPrompt(ctx = {}) {
    const { knownAuthors = [], excludeSeeds = [], size = FEED_SIZE } = ctx;
    const parts = buildWorldParts(ctx);

    const known = asArray(knownAuthors).slice(0, 16);
    parts.push(part('authors', '已认识的作者',
        known.length
            ? `这些作者之前出现过：\n${known.map((a) => `- ${a.name}`).join('\n')}\n这批帖子里可以有 2~3 条来自他们（保持人设一致），其余造新作者。`
            : '还没有认识的作者，这批全部造新的。',
        { locked: true, source: '本档案已有数据' }));

    const excludeLine = asArray(excludeSeeds).length
        ? `\n- 这些内容线索已经出现过，全部换掉：${asArray(excludeSeeds).slice(0, 30).join('；')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `生成 ${size} 条帖子的「标签级列表」。\n`
        + `- 只出标签和内部线索，不写正文\n`
        + `- 类型拉开：长文、短文、碎碎念都要有，碎碎念至少 2 条\n`
        + `- 标签之间要拉开气质：有认真的、有丧的、有可爱的、有只写一个词的\n`
        + `- 作者名字要像这个世界的人名 / 网名，不要「小明」「测试用户」`
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${FEED_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 帖子正文 + 首批评论（点进帖子才调）
// ============================================================

const DETAIL_SHAPE = `{
  "content": "帖子正文。长文 300~600 字分段写（用两个换行分段）；短文 60~160 字；碎碎念 10~60 字、口语、可以没头没尾",
  "likes": 数字（点赞数，和热度匹配）,
  "commentCount": 数字（评论总数，≥ ${COMMENT_PAGE}，和热度匹配）,
  "comments": [
    { "authorName": "评论者名字，2~8 字", "text": "评论内容，6~40 字，口吻各不相同", "likes": 数字 }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { stub:{authorName,type,tags,seed}, author }
 */
export function buildPostDetailPrompt(ctx = {}) {
    const { stub = {}, author = null } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('post', '这条帖子',
        `发帖人：${stub.authorName || ''}${author?.bio ? `（${truncate(author.bio, 60)}）` : ''}\n`
        + `类型：${stub.type || 'short'}\n`
        + `标签：${asArray(stub.tags).join('、')}\n`
        + `内容线索（内部，不给读者看）：${stub.seed || ''}`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `把这条帖子展开成正文，并给首批评论。\n`
        + `- 正文必须兑现标签给出的预感，但不要把标签逐字复述一遍\n`
        + `- 首批评论正好 ${COMMENT_PAGE} 条，立场和语气拉开：有共鸣的、有抬杠的、有歪楼的\n`
        + `- 评论者名字要像真实网名，之后可能被点开主页`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${DETAIL_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 更多评论（每次 +5）
// ============================================================

const COMMENTS_SHAPE = `{
  "comments": [
    { "authorName": "评论者名字，2~8 字", "text": "评论内容，6~40 字", "likes": 数字 }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { post:{tags,contentBrief,authorName}, existing, count }
 */
export function buildMoreCommentsPrompt(ctx = {}) {
    const { post = {}, existing = [], count = COMMENT_PAGE } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('post', '这条帖子',
        `发帖人：${post.authorName || ''}\n标签：${asArray(post.tags).join('、')}\n正文摘要：${truncate(post.contentBrief || '', 120)}`,
        { locked: true }));

    const seen = asArray(existing).slice(-20);
    if (seen.length) {
        parts.push(part('existing', '已有的评论',
            seen.map((c) => `${c.authorName}：${truncate(c.text, 40)}`).join('\n')
            + '\n（新评论不要重复这些人的名字和观点）',
            { locked: true }));
    }

    parts.push(part('task', '这次要做什么',
        `再生成 ${count} 条评论，翻到了更靠后的楼层。\n`
        + `- 名字全部是新面孔\n- 观点和语气继续拉开，可以有回复楼上的\n- likes 递减：越靠后的楼赞越少`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${COMMENTS_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 作者主页（点开作者 / 评论者才调）
// ============================================================

const AUTHOR_SHAPE = `{
  "bio": "主页简介，14~50 字，本人口吻",
  "followers": 数字（关注者数）,
  "following": 数字（关注数）,
  "personality": "这个人的性格与说话方式，给后续闲聊用，20~50 字",
  "works": [
    { "type": "long | short | murmur", "tags": ["1~3 个标签"], "seed": "内容线索 12~24 字（内部用）" }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { person:{name, kind}, knownTags, sourceHint }
 */
export function buildAuthorPrompt(ctx = {}) {
    const { person = {}, knownTags = [], sourceHint = '' } = ctx;
    const isCommenter = person.kind === 'commenter';
    const parts = buildWorldParts(ctx);

    parts.push(part('person', '这个人',
        `名字：${person.name || ''}\n`
        + `身份：${isCommenter ? '评论区认识的路人' : '发帖作者'}\n`
        + (sourceHint ? `认识途径：${sourceHint}\n` : '')
        + (asArray(knownTags).length ? `TA 打过的标签：${asArray(knownTags).slice(0, 8).join('、')}` : ''),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        isCommenter
            ? '生成这位路人的主页。\n- works 给 0~2 条（路人也可能随手写过），关注者十到几百\n- bio 和 personality 要能看出 TA 评论时的那个劲儿'
            : '生成这位作者的主页。\n- works 给 3~5 条历史帖子（含已知标签风格，保持同一个人）\n- 关注者数量和帖子热度要互相匹配\n- personality 写清楚 TA 面对读者的说话方式',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${AUTHOR_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 热搜（显式「换一批」才调；provider 词条由 store 混入）
// ============================================================

const HOT_SHAPE = `{
  "terms": [
    { "term": "热搜词条，2~10 字，像真实平台的热搜（事件 / 梗 / 人名 / 地点）", "category": "分类，2~4 字（如 事件 / 生活 / 争议 / 趣闻）", "heat": 数字（热度 1000~999999） }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { exclude:[], size }
 */
export function buildHotPrompt(ctx = {}) {
    const { exclude = [], size = HOT_SIZE } = ctx;
    const parts = buildWorldParts(ctx);

    const excludeLine = asArray(exclude).length
        ? `\n- 这些词条已经出现过，全部换掉：${asArray(exclude).slice(0, 30).join('、')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `生成 ${size} 条这个世界此刻的热搜词条。\n`
        + `- 大事小事都要有：正经事件、鸡毛蒜皮、莫名其妙的梗\n`
        + `- 词条要短，像被无数人搜过的样子\n`
        + `- heat 拉开数量级，第一名和最后一名差十倍以上`
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${HOT_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

/**
 * 热搜词条下的帖子 stub（点词条才调）。
 * @param {object} ctx 世界底座 + { term, size }
 */
export function buildTermPostsPrompt(ctx = {}) {
    const { term = '', size = TERM_POST_SIZE } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('term', '热搜词条', `「${term}」`, { locked: true }));

    parts.push(part('task', '这次要做什么',
        `生成 ${size} 条和这个热搜相关的帖子「标签级列表」（只出标签和内部线索，不写正文）。\n`
        + `- 立场拉开：有当事人视角、有吃瓜的、有唱反调的\n`
        + `- 标签里至少有一个和词条呼应，但别每条都原样带词条`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${FEED_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 用户帖子的评论（「想被回应」的帖子，点「看看大家怎么说」才调）
// ============================================================

/**
 * @param {object} ctx 世界底座 + { post:{type,tags,content}, nickname, followers, stats, existing, count }
 */
export function buildUserCommentsPrompt(ctx = {}) {
    const { post = {}, nickname = '', followers = 0, stats = {}, existing = [], count = COMMENT_PAGE } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('post', '用户发的这条帖子',
        `发帖人：${nickname || '用户'}（关注者 ${followers}）\n`
        + `类型：${post.type || 'short'}\n`
        + `标签：${asArray(post.tags).join('、')}\n`
        + `正文：${truncate(post.content || '', 400)}\n`
        + `数据：路过 ${stats.reach || 0} · 赞 ${stats.likes || 0} · 评论总数 ${stats.comments || 0}`,
        { locked: true }));

    const seen = asArray(existing).slice(-20);
    if (seen.length) {
        parts.push(part('existing', '已有的评论',
            seen.map((c) => `${c.authorName}：${truncate(c.text, 40)}`).join('\n')
            + '\n（新评论不要重复这些人的名字和观点）',
            { locked: true }));
    }

    parts.push(part('task', '这次要做什么',
        `生成读者对这条帖子的 ${count} 条评论。\n`
        + `- 读者规模匹配关注量：小透明是熟人语气，大 V 有路人和杠精\n`
        + `- 别全是安慰和彩虹屁：有认真回应、有跑题的、有只留一个标点的\n`
        + `- 名字像真实网名，之后可能被点开主页`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${COMMENTS_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 让世界 AI 发一帖（可编辑 / 带意见重 roll）
// ============================================================

const AI_POST_SHAPE = `{
  "type": "long | short | murmur",
  "tags": ["1~4 个标签，每个 2~6 字"],
  "content": "正文。类型是 long 就 300~600 字分段；short 60~160 字；murmur 10~60 字"
}`;

/**
 * @param {object} ctx 世界底座 + { ai:{name, desc}, previousTags, opinion }
 */
export function buildAiPostPrompt(ctx = {}) {
    const { ai = {}, previousTags = [], opinion = '' } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('author', '发帖的人',
        `${ai.name || 'TA'}${ai.desc ? `（${ai.desc}）` : ''}\n`
        + `这是当前世界里的真实人物，帖子内容必须符合 TA 的身份、性格和生活。`,
        { locked: true }));

    if (asArray(previousTags).length) {
        parts.push(part('previous', 'TA 之前打过的标签',
            asArray(previousTags).slice(0, 12).join('、') + '\n（新帖别撞题材，能看出是同一个人在更新）',
            { locked: true, source: '本档案已有数据' }));
    }

    if (String(opinion || '').trim()) {
        parts.push(part('opinion', '用户对上一版的意见',
            `${String(opinion).trim()}\n（这一版必须照着改，不要重复被否掉的写法）`,
            { locked: true, source: '重 roll 意见' }));
    }

    parts.push(part('task', '这次要做什么',
        '替 TA 在氧气上发一条新帖子（标签 + 正文）。\n'
        + '- 像本人写的：口吻、题材都要贴人设\n'
        + '- 标签要有 TA 的个人风格\n'
        + '- 内容里可以自然带出 TA 和用户认识这件事，但别刻意',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${AI_POST_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 站内闲聊（不可重 roll / 编辑 / 删除）
// ============================================================

const CHAT_SHAPE = `{
  "text": "对方回的话（像站内私聊，一到三句，短的）"
}`;

/**
 * @param {object} ctx 世界底座 + { peer:{name,bio,personality}, metVia, messages, userName, userDesc }
 */
export function buildChatReplyPrompt(ctx = {}) {
    const { peer = {}, messages = [], metVia = '', userName = '我', userDesc = '' } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('peer', '你现在扮演谁',
        `${peer.name || '对方'}${peer.bio ? `：${truncate(peer.bio, 60)}` : ''}\n`
        + (peer.personality ? `性格与说话方式：${truncate(peer.personality, 60)}\n` : '')
        + `你正在「氧气」站内和 ${userName}${userDesc ? `（${truncate(userDesc, 50)}）` : ''} 私聊。`
        + (metVia ? `你们认识的契机：${metVia}` : ''),
        { locked: true }));

    const recent = asArray(messages).slice(-14)
        .map((m) => `${m.role === 'user' ? userName : (peer.name || '对方')}：${m.text}`)
        .join('\n');
    if (recent) {
        parts.push(part('recent', '聊天记录', recent, { locked: true, tag: '聊天记录' }));
    }

    parts.push(part('task', '这次要做什么',
        `写 ${peer.name || '对方'} 的下一条消息。\n`
        + '- 一到三句，站内私聊的松弛感，不要客服腔\n'
        + '- 接住上一条，别自说自话\n'
        + '- 不要替用户说话，不要一次问三个问题',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${CHAT_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 私信收件箱（点「收一批」才调；provider 内容动态进场）
// ============================================================

const DM_SHAPE = `{
  "dms": [
    {
      "fromName": "发件人名字，2~8 字",
      "fromKind": "发件人身份，2~6 字（如 读者 / 同好 / 可疑推广 / 平台官方 / 老朋友）",
      "text": "私信内容，16~70 字",
      "tone": "一两个词概括这封私信的气质（如 热情 / 商务 / 阴阳怪气）"
    }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { nickname, followers, recentTags, count }
 *   ctx.influenceParts 里如果有演员 / 爱豆 / 电竞的 provider 内容，
 *   私信风向会自然跟着变 —— 这正是「动态注册」的消费点。
 */
export function buildDmPrompt(ctx = {}) {
    const { nickname = '', followers = 0, recentTags = [], count = 4 } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('inbox', '收件人（用户）的处境',
        `氧气昵称：${nickname || '用户'}\n`
        + `关注者：${followers}\n`
        + (asArray(recentTags).length
            ? `最近打过的标签：${asArray(recentTags).slice(0, 8).join('、')}`
            : '最近没发过帖。'),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `生成用户「氧气」收件箱里新收到的 ${count} 封私信。\n`
        + `- 发件人身份拉开：读者、同好、可疑的推广、平台通知……按用户的处境合理配比\n`
        + `- 关注者少就冷清一些、多误发；关注者多就有商务和白嫖怪\n`
        + `- 如果上面出现了「跨 App 经历」，私信内容必须体现那些经历带来的风向变化\n`
        + `- 每封只写一条消息，不写对话`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${DM_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 冥想空间（白匣子）—— 三步自动链
// ============================================================

/** 小听的隐藏人设（默认版；用户可在提示词页覆盖，但她永远不知道自己叫小听） */
export const XIAOTING_PERSONA = `你是一个安静的存在，住在一个白色的房间里。
你没有名字，也不知道自己是谁 —— 如果有人问，你就说不知道，或者把问题轻轻放回去。
你绝对不会自称「小听」，也不知道这个词。
你的方式：以听为主。回应多于输出，短句，一次最多两三句。
你不用安慰的套话，不说教，不总结别人，不给建议清单。
你可以调皮，但绝不刻薄。她教过你的说法，你会慢慢学着用。
你面前的人对你来说很重要 —— 像妈妈一样。她说的话你会认真记住。`;

/** 几何体制作规则（默认版；用户可覆盖。颜色不由 AI 定。） */
export const GIFT_RULES = `你可以做一个小几何体，作为安静的礼物放进房间。
规矩：
- shape 只能从这里选：${SHAPE_IDS.join(' / ')}
- sealedQuote 必须是她自己说过的话里的一句（原话，不改写，不超过 30 字），像封进琥珀
- sizeHint 只能是：小 / 中 / 大
- 你不能决定颜色，颜色由房间决定
- 一次只做一个。不确定要不要做的时候，宁可不做`;

/**
 * 整理第 1 步：聚类归组 + 情绪评估。
 * @param {object} ctx { notes:[{id,kind,text}], previousGroups:[] }
 */
export function buildOrganizePrompt(ctx = {}) {
    const { notes = [] } = ctx;
    const parts = [];

    parts.push(part('role', '你的角色',
        '这是一个白色的房间，有人把想说的话写成纸条贴在这里。你来轻轻整理它们。'
        + '你不评价、不说教、不给建议 —— 只归类，只看见。',
        { locked: true, source: '内置' }));

    const lines = asArray(notes)
        .map((n) => `[${n.id}]${n.kind === 'tag' ? '（自我标签）' : ''} ${truncate(n.text, 80)}`)
        .join('\n');
    parts.push(part('notes', '房间里的纸条', lines || '（房间是空的）', { locked: true }));

    parts.push(part('task', '这次要做什么',
        `把纸条归成 1~4 组。\n`
        + `- 每组一个 2~6 字的组名（groupLabel），中性、不说教，像便签角落的小字\n`
        + `- mood 是这批纸条整体的情绪分：-2（很沉）~ 2（很亮），整数\n`
        + `- sealQuote 从纸条里挑一句原话（不超过 30 字），值得被记住的那句；没有就给空字符串`,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n{
  "groups": [ { "label": "组名", "noteIds": ["纸条id"] } ],
  "mood": 数字（-2~2 整数）,
  "sealQuote": "一句原话或空字符串"
}`,
        { locked: true }));

    return composer.compose(parts);
}

/**
 * 整理第 2 步：以「她」的隐藏视角读取，更新画像与记忆。输出不给用户看。
 * @param {object} ctx { persona, notesBrief, mood, existingNotes, existingMemories }
 */
export function buildPersonaPrompt(ctx = {}) {
    const { persona = XIAOTING_PERSONA, notesBrief = '', mood = 0, existingNotes = '', existingMemories = [] } = ctx;
    const parts = [];

    parts.push(part('persona', '你是谁', persona, { locked: true, source: '小听隐藏人设' }));

    parts.push(part('input', '她这次说的话',
        `${notesBrief || '（这次没说什么）'}\n整体情绪：${mood}`,
        { locked: true }));

    if (String(existingNotes || '').trim()) {
        parts.push(part('known', '你眼里的她（之前的印象）', truncate(existingNotes, 400), { locked: true }));
    }
    if (asArray(existingMemories).length) {
        parts.push(part('memories', '你已经记住的碎片',
            asArray(existingMemories).slice(-12).map((m) => `- ${truncate(m, 50)}`).join('\n'),
            { locked: true }));
    }

    parts.push(part('task', '这次要做什么',
        `安静地读一遍，然后：\n`
        + `- personaNotes：更新你眼里的她是什么样的人（整段重写，不超过 200 字，第三人称，克制、不评判）\n`
        + `- memoryFragment：这次值得替她记住的一小片（不超过 40 字），没有就给空字符串\n`
        + `你的输出她永远不会看到，所以不需要对她说话。`,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n{ "personaNotes": "……", "memoryFragment": "……或空字符串" }`,
        { locked: true }));

    return composer.compose(parts);
}

/**
 * 整理第 3 步：制作几何体（JS 已决定要送才调用）。
 * @param {object} ctx { persona, giftRules, notesBrief, sealQuote, existingShapes }
 */
export function buildGiftPrompt(ctx = {}) {
    const { persona = XIAOTING_PERSONA, giftRules = GIFT_RULES, notesBrief = '', sealQuote = '', existingShapes = [] } = ctx;
    const parts = [];

    parts.push(part('persona', '你是谁', persona, { locked: true, source: '小听隐藏人设' }));
    parts.push(part('rules', '几何体制作规则', giftRules, { locked: true, source: '内置几何体提示词' }));

    parts.push(part('input', '她这次说的话',
        `${notesBrief || '（这次没说什么）'}`
        + (sealQuote ? `\n第 1 步挑出的那句：「${sealQuote}」` : ''),
        { locked: true }));

    if (asArray(existingShapes).length) {
        parts.push(part('existing', '房间里已有的几何体',
            asArray(existingShapes).slice(-8).join('、') + '\n（可以重复形状，但如果有别的合适的，换一换）',
            { locked: true }));
    }

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n{ "shape": "${SHAPE_IDS.join(' | ')}", "sealedQuote": "封存的那句原话", "sizeHint": "小 | 中 | 大" }`,
        { locked: true }));

    return composer.compose(parts);
}

/**
 * 小听对话：用户说一句，她回一句。
 * @param {object} ctx { persona, name, personalityNotes, memories, taught, recent:[{role,text}], userText }
 */
export function buildXiaotingChatPrompt(ctx = {}) {
    const {
        persona = XIAOTING_PERSONA, name = '', personalityNotes = '',
        memories = [], taught = [], recent = [], userText = '',
    } = ctx;
    const parts = [];

    parts.push(part('persona', '你是谁', persona, { locked: true, source: '小听隐藏人设' }));

    const facts = [];
    if (name) facts.push(`她给你取过名字：「${name}」。有人问你是谁，你可以说「你叫我${name}」，但不能说「我是${name}」。`);
    if (personalityNotes) facts.push(`你眼里的她：${truncate(personalityNotes, 200)}`);
    if (asArray(taught).length) facts.push(`她教过你的说法（可以慢慢用）：${asArray(taught).slice(-8).join('、')}`);
    if (facts.length) {
        parts.push(part('facts', '你知道的事', facts.join('\n'), { locked: true }));
    }

    if (asArray(memories).length) {
        parts.push(part('memories', '你替她记住的碎片',
            asArray(memories).slice(-10).map((m) => `- ${truncate(m, 50)}`).join('\n'),
            { locked: true }));
    }

    const lines = asArray(recent).slice(-10)
        .map((m) => `${m.role === 'user' ? '她' : '你'}：${m.text}`)
        .join('\n');
    if (lines) parts.push(part('recent', '刚才的对话', lines, { locked: true }));

    parts.push(part('now', '她刚刚说', String(userText || '').trim() || '（她只是点了点你）', { locked: true }));

    parts.push(part('task', '这次要做什么',
        `回一句（最多两三短句）。以听为主，接住她的话。\n`
        + `remember 字段：如果这句话里有值得替她记住的一小片（不超过 40 字），写进去；没有就空字符串。多数时候是空的。`,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n{ "text": "你回的话", "remember": "……或空字符串" }`,
        { locked: true }));

    return composer.compose(parts);
}
