/**
 * 萤火 · 提示词组装（唯一真相）
 *
 * ── 一条硬规矩 ────────────────────────────────────────────────────
 * 每个 build* 都走 `composeContext()`，返回 `{ text, parts, stats }`：
 *   text   发给 AI 的那一份
 *   parts  「查看提示词」面板渲染的那一份
 * 是同一次调用的两个返回字段，物理上不可能不一致。
 *
 * ── 世界观是必传的 ────────────────────────────────────────────────
 * 「你的角色」和「世界观简介」两段 locked，用户不能关；
 * 可关的是夹子、prompt 库条目、口味和跨 App 经历（provider）。
 *
 * ── 跨 App 经历（provider）───────────────────────────────────────
 * ctx.influenceParts 由 store 在生成前通过
 * `toolkit.socialInfluences.collect('youtube', …)` 收集，已经是 part 形状，
 * 这里原样拼进 —— 演员 / 爱豆 / 电竞上线后不用改这个文件。
 *
 * ★ 本文件是纯函数：不读 window、不读 store。所有数据由调用方传进来，
 *   node 测试直接 import。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { COMMENT_PAGE, FEED_SIZE, JSON_RULE } from '../constants.js';
import { asArray, truncate } from '../utils.js';

const composer = createContextComposer({ namespace: 'youtube' });

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
// 世界观底座 —— 所有生成都以它开头
// ============================================================

/**
 * @param {object} ctx
 * @param {object}   ctx.identity        world-context.readIdentity() 快照
 * @param {string}   ctx.summary         世界观简介
 * @param {object[]} ctx.clips           选中的夹子
 * @param {object[]} ctx.prompts         选中的 prompt 库条目
 * @param {string}   ctx.taste           用户爱看什么
 * @param {object[]} [ctx.influenceParts] socialInfluences.collect 的结果（已是 part 形状）
 */
export function buildWorldParts(ctx = {}) {
    const { identity = {}, clips = [], prompts = [], taste = '', summary = '' } = ctx;

    const out = [];

    out.push(part('role', '你的角色',
        `你在为一个叫「萤火」的视频软件生成内容。这个软件活在下面这个世界里：`
        + `上面的每一条视频、每一个频道主、每一条评论，都必须是这个世界里真实会出现的。`
        + `不要出现现实世界的平台名、真实明星、品牌和地名。`
        + `视频没有真实画面 —— 你写的是标题、封面短语、简介和内容梗概，观众靠文字「看」视频。`
        + `不要色情、不要擦边封面，封面大字不要性暗示，也不要写成带货广告。`,
        { locked: true, source: '内置' }));

    // ★ 世界名要写进**正文**：段标题只是给用户看的，不进发送文本
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

    if (String(taste || '').trim()) {
        out.push(part('taste', '用户爱看什么', String(taste).trim(), { source: '首次配置' }));
    }

    for (const extra of asArray(ctx.influenceParts)) {
        if (extra && extra.content) out.push({ ...extra });
    }

    return out;
}

// ============================================================
// 视频列表
// ============================================================

const FEED_SHAPE = `{
  "videos": [
    {
      "title": "视频标题，8~24 字，像真实平台上的标题（有钩子但别标题党到失真）",
      "coverText": "封面上的大字，2~8 字（软件用文字模拟封面，这是封面视觉主体）",
      "creatorName": "频道主名字，2~8 字（可以复用下面「已认识的频道主」里的名字）",
      "kind": "分区，2~4 字（如 日常 / 教学 / 探险 / 美食 / 纪实，要符合这个世界）",
      "blurb": "一句话内容预告，14~30 字",
      "tags": ["两到三个短标签，每个 2~4 字"],
      "durationSec": 数字（视频时长秒数，60~1800）,
      "views": 数字（播放量，按频道大小合理给）
    }
  ]
}`;

/**
 * 生成一批视频。只出列表不出详情 —— 详情等用户点进去再生成。
 *
 * @param {object} ctx 世界底座 + 以下字段
 * @param {object[]} ctx.knownCreators  已认识的频道主 [{name, kind, followers}]
 * @param {string[]} ctx.exclude        已出现过的标题
 * @param {number}   ctx.size
 */
export function buildFeedPrompt(ctx = {}) {
    const { knownCreators = [], exclude = [], size = FEED_SIZE } = ctx;
    const parts = buildWorldParts(ctx);

    const known = asArray(knownCreators).slice(0, 16);
    parts.push(part('creators', '已认识的频道主',
        known.length
            ? `这些频道主之前出现过（名字 → 定位）：\n`
              + known.map((c) => `- ${c.name}${c.kind ? `（${c.kind}）` : ''}`).join('\n')
              + `\n这批视频里可以有 2~3 条来自他们（保持人设一致），其余造新频道主。`
            : '还没有认识的频道主，这批全部造新的。',
        { locked: true, source: '本档案已有数据' }));

    const excludeLine = asArray(exclude).length
        ? `\n- 这些标题已经出现过，全部换掉：${asArray(exclude).slice(0, 40).join('、')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `生成 ${size} 条视频列表。\n`
        + `- 题材拉开：生活向、知识向、热闹的、冷门的都要有\n`
        + `- 频道主名字要像这个世界的人名 / 网名，不要「小明」「测试用户」\n`
        + `- coverText 是封面大字：短、有冲击力，和标题不要一模一样\n`
        + `- views 要符合频道体量：新人几百，头部几十万，别全是爆款`
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${FEED_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 视频详情 + 首批评论
// ============================================================

const DETAIL_SHAPE = `{
  "intro": "视频简介，40~90 字，频道主的口吻",
  "sections": [
    { "at": "时间点如 00:00", "text": "这一段视频里发生什么，20~45 字" }
  ],
  "likes": 数字（点赞数，少于播放量）,
  "commentCount": 数字（这条视频的评论总数，按热度合理给）,
  "comments": [
    { "authorName": "评论者名字，2~8 字", "text": "评论内容，8~40 字，口吻各不相同", "likes": 数字 }
  ]
}`;

/**
 * 详情。用户点进视频才调。
 * @param {object} ctx 世界底座 + { video, creator }
 */
export function buildVideoDetailPrompt(ctx = {}) {
    const { video = {}, creator = null } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('video', '这条视频',
        `标题：${video.title || ''}\n`
        + `封面大字：${video.coverText || ''}\n`
        + `频道主：${video.creatorName || ''}${creator?.bio ? `（${truncate(creator.bio, 60)}）` : ''}\n`
        + `分区：${video.kind || ''}\n`
        + `预告：${video.blurb || ''}\n`
        + `播放量：${video.views || 0}`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `把这条视频展开成详情页。\n`
        + `- sections 是「视频内容」的分段梗概，4~6 段，按时间推进，观众读完等于看完了视频\n`
        + `- 首批评论正好 ${COMMENT_PAGE} 条，立场和语气拉开：有夸的、有问的、有歪楼的\n`
        + `- 评论者名字要像真实网名，之后可能被点开主页，别起一次性的怪名\n`
        + `- commentCount 是评论总数，要 ≥ ${COMMENT_PAGE}，和播放量匹配`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${DETAIL_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 更多评论（每次 +5）
// ============================================================

const COMMENTS_SHAPE = `{
  "comments": [
    { "authorName": "评论者名字，2~8 字", "text": "评论内容，8~40 字", "likes": 数字 }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { video, existing:[{authorName,text}], count }
 */
export function buildMoreCommentsPrompt(ctx = {}) {
    const { video = {}, existing = [], count = COMMENT_PAGE } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('video', '这条视频',
        `标题：${video.title || ''}\n频道主：${video.creatorName || ''}\n内容预告：${video.blurb || ''}`,
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
// 站内用户主页（频道主 / 评论区观众通用）
// ============================================================

const CREATOR_SHAPE = `{
  "bio": "主页简介，20~60 字，本人口吻",
  "followers": 数字（粉丝数）,
  "following": 数字（关注数）,
  "personality": "这个人的性格与说话方式，给后续闲聊用，20~50 字",
  "works": [
    { "title": "代表作标题", "coverText": "封面大字 2~8 字", "views": 数字, "durationSec": 数字 }
  ]
}`;

/**
 * 点开频道主 / 评论者头像才调。
 * @param {object} ctx 世界底座 + { person:{name, kind}, knownWorks:[标题], sourceHint }
 */
export function buildPersonPrompt(ctx = {}) {
    const { person = {}, knownWorks = [], sourceHint = '' } = ctx;
    const isViewer = person.kind === 'viewer';
    const parts = buildWorldParts(ctx);

    parts.push(part('person', '这个人',
        `名字：${person.name || ''}\n`
        + `身份：${isViewer ? '普通观众（在评论区认识的）' : '频道主'}\n`
        + (sourceHint ? `认识途径：${sourceHint}\n` : '')
        + (asArray(knownWorks).length ? `已知作品：${asArray(knownWorks).slice(0, 6).join('、')}` : ''),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        isViewer
            ? '生成这位观众的主页。\n- works 给 0~2 条（观众也可能随手发过东西），粉丝数十到几百\n- bio 和 personality 要能看出 TA 评论时的那个劲儿'
            : '生成这位频道主的主页。\n- works 给 3~5 条代表作（含已知作品，标题不要改）\n- 粉丝数和作品播放量要互相匹配\n- personality 写清楚 TA 面对观众的说话方式',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${CREATOR_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 直播（一次生成：主题 + 主播话术 + 弹幕池）
// ============================================================

const LIVE_SHAPE = `{
  "topic": "直播主题，6~16 字",
  "announcement": "直播间置顶公告，12~30 字",
  "hostLines": [
    { "atSec": 数字（第几秒说这句，从 0 递增）, "text": "主播说的话，10~40 字" }
  ],
  "danmaku": [
    { "atSec": 数字（第几秒飘出，从 0 递增，和主播话术穿插）, "name": "弹幕观众名字", "text": "弹幕内容，2~18 字" }
  ]
}`;

/**
 * 进直播间且主播在播才调，**一场只调一次**；逐条飘出由 JS 定时调度。
 * @param {object} ctx 世界底座 + { creator, viewers, danmakuCount }
 */
export function buildLivePrompt(ctx = {}) {
    const { creator = {}, viewers = 0, danmakuCount = 28 } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('host', '主播',
        `${creator.name || ''}${creator.bio ? `：${truncate(creator.bio, 60)}` : ''}\n`
        + (creator.personality ? `说话方式：${truncate(creator.personality, 50)}\n` : '')
        + (asArray(creator.works).length ? `代表作：${asArray(creator.works).slice(0, 3).map((w) => w.title).join('、')}\n` : '')
        + `当前观众数：约 ${viewers} 人`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `生成一场约 3 分钟的直播切片。\n`
        + `- hostLines 8~12 句，atSec 在 0~170 之间递增，是主播边做事边说的话\n`
        + `- danmaku 正好 ${danmakuCount} 条，atSec 在 0~175 之间大致均匀、和主播话术有呼应\n`
        + `- 弹幕要像真弹幕：短、口语、有梗、有刷屏、有问问题的，别每条都完整成句\n`
        + `- 弹幕观众名字可以重复出现 2~3 次（同一个人连发），大部分是新名字`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${LIVE_SHAPE}`, { locked: true }));

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
        + `你正在「萤火」站内和 ${userName}${userDesc ? `（${truncate(userDesc, 50)}）` : ''} 私聊。`
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
// 让世界 AI 发一条视频（可编辑 / 带意见重 roll）
// ============================================================

const AI_VIDEO_SHAPE = `{
  "title": "视频标题，8~24 字",
  "coverText": "封面大字，2~8 字",
  "kind": "分区，2~4 字",
  "blurb": "一句话预告，14~30 字",
  "intro": "简介，30~80 字，TA 本人的口吻",
  "sections": [
    { "at": "时间点如 00:00", "text": "这一段发生什么，20~45 字" }
  ],
  "durationSec": 数字,
  "tags": ["两到三个短标签"]
}`;

/**
 * 用户点「让 TA 发视频」才调。
 * @param {object} ctx 世界底座 + { ai:{name, desc}, previousTitles, opinion }
 */
export function buildAiVideoPrompt(ctx = {}) {
    const { ai = {}, previousTitles = [], opinion = '' } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('author', '发视频的人',
        `${ai.name || 'TA'}${ai.desc ? `（${ai.desc}）` : ''}\n`
        + `这是当前世界里的真实人物，视频内容必须符合 TA 的身份、性格和生活。`,
        { locked: true }));

    if (asArray(previousTitles).length) {
        parts.push(part('previous', 'TA 已发过的视频',
            asArray(previousTitles).slice(0, 8).join('、') + '\n（新视频别撞题材，能看出是同一个人在更新）',
            { locked: true, source: '本档案已有数据' }));
    }

    if (String(opinion || '').trim()) {
        parts.push(part('opinion', '用户对上一版的意见',
            `${String(opinion).trim()}\n（这一版必须照着改，不要重复被否掉的写法）`,
            { locked: true, source: '重 roll 意见' }));
    }

    parts.push(part('task', '这次要做什么',
        '替 TA 发一条新视频（标题 + 封面大字 + 简介 + 4~6 段内容梗概）。\n'
        + '- 像本人拍的：口吻、题材、镜头感都要贴人设\n'
        + '- 内容里可以自然带出 TA 和用户认识这件事，但别刻意',
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${AI_VIDEO_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 用户视频的评论（总量 JS 定，正文按批生成）
// ============================================================

/**
 * @param {object} ctx 世界底座 + { upload, channel:{nickname,followers}, stats, existing, count }
 */
export function buildUserCommentsPrompt(ctx = {}) {
    const { upload = {}, channel = {}, stats = {}, existing = [], count = COMMENT_PAGE } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('video', '用户发的这条视频',
        `频道：${channel.nickname || '用户'}（粉丝 ${channel.followers || 0}）\n`
        + `标题：${upload.title || ''}\n`
        + `简介：${truncate(upload.intro || upload.blurb || '', 100)}\n`
        + `数据：播放 ${stats.views || 0} · 赞 ${stats.likes || 0} · 评论总数 ${stats.comments || 0}`,
        { locked: true }));

    const seen = asArray(existing).slice(-20);
    if (seen.length) {
        parts.push(part('existing', '已有的评论',
            seen.map((c) => `${c.authorName}：${truncate(c.text, 40)}`).join('\n')
            + '\n（新评论不要重复这些人的名字和观点）',
            { locked: true }));
    }

    parts.push(part('task', '这次要做什么',
        `生成观众对这条视频的 ${count} 条评论。\n`
        + `- 观众规模要匹配频道体量：小频道是熟人语气，大频道有路人和黑粉\n`
        + `- 别全是彩虹屁：有认真反馈、有跑题的、有催更的\n`
        + `- 名字像真实网名，之后可能被点开主页`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${COMMENTS_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}

// ============================================================
// 私信收件箱（点「生成私信」才调；provider 内容动态进场）
// ============================================================

const DM_SHAPE = `{
  "dms": [
    {
      "fromName": "发件人名字，2~8 字",
      "fromKind": "发件人身份，2~6 字（如 粉丝 / 同行 / 品牌方 / 平台官方 / 老朋友）",
      "text": "私信内容，20~80 字",
      "tone": "一两个词概括这封私信的气质（如 热情 / 商务 / 阴阳怪气）"
    }
  ]
}`;

/**
 * @param {object} ctx 世界底座 + { channel, uploadsBrief, count }
 *   ctx.influenceParts 里如果有演员 / 爱豆 / 电竞的 provider 内容，
 *   私信风向会自然跟着变 —— 这正是「动态注册」的消费点。
 */
export function buildDmPrompt(ctx = {}) {
    const { channel = {}, uploadsBrief = [], count = 4 } = ctx;
    const parts = buildWorldParts(ctx);

    parts.push(part('inbox', '收件人（用户）的处境',
        `频道名：${channel.nickname || '用户'}\n`
        + `粉丝数：${channel.followers || 0}\n`
        + (channel.bio ? `频道简介：${truncate(channel.bio, 60)}\n` : '')
        + (asArray(uploadsBrief).length
            ? `最近发过：${asArray(uploadsBrief).slice(0, 5).join('、')}`
            : '还没发过视频。'),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `生成用户「萤火」收件箱里新收到的 ${count} 封私信。\n`
        + `- 发件人身份拉开：粉丝、同行、可疑的推广、平台通知……按用户的处境合理配比\n`
        + `- 粉丝少就少一些商务、多一些误发和冷清；粉丝多就有品牌方和白嫖怪\n`
        + `- 如果上面出现了「跨 App 经历」，私信内容必须体现那些经历带来的风向变化\n`
        + `- 每封只写一条消息，不写对话`,
        { locked: true }));

    parts.push(part('format', '输出格式', `${JSON_RULE}\n结构：\n${DM_SHAPE}`, { locked: true }));

    return composer.compose(parts);
}
