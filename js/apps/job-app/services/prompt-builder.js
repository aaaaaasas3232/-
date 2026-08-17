/**
 * 灯塔 · 提示词组装（唯一真相）
 *
 * ── 一条硬规矩 ────────────────────────────────────────────────────
 *
 * 每个 build* 都返回 `{ text, parts }`：
 *   `text`  发给 AI 的那一份
 *   `parts` 管理页 / 预览面板渲染的那一份
 *
 * 是**同一次调用的两个返回字段**，不是两个函数。
 * 只要是两个函数，无论一开始写得多一致，都会分叉；这是时间问题不是能力问题。
 * 梦境编织原型最严重的 bug 就是这个：用户在预览里关掉世界观、保存、发送，
 * 世界观照发不误，而且不报任何错。
 *
 * ── 分工 ──────────────────────────────────────────────────────────
 *
 *   `prompt-cards.js`   用户能开关和改的那些段（角色 / 世界观 / 写法 / 规则）
 *   本文件              占位符替换 + 每个场景各自的「这次要做什么」和「输出格式」
 *
 * 「输出格式」不做成卡片：它和解析代码是一体的，用户改了就解析不出来了，
 * 而失败现象会是「AI 没按格式返回」—— 他根本不会想到是自己上周改的。
 */

import { JSON_RULE, FEED_SIZE, JOB_CATEGORIES, PERFORMANCE_LEVELS } from '../constants.js';
import { asArray, fmtMoney, truncate, fmtDay } from '../utils.js';
import { SCENES, cardsForScene } from './prompt-cards.js';

/**
 * @typedef {{ id:string, title:string, text:string, locked?:boolean, included:boolean }} Part
 */

function part(id, title, text, opts = {}) {
    return {
        id,
        title,
        text: String(text || '').trim(),
        locked: opts.locked === true,
        included: opts.included !== false,
    };
}

function joinParts(parts) {
    return parts
        .filter((p) => p.included && p.text)
        .map((p) => `# ${p.title}\n${p.text}`)
        .join('\n\n');
}

// ============================================================
// 占位符
// ============================================================

/**
 * 替换卡片正文里的 `{{中文}}` 占位符。
 *
 * 值为空时**整张卡会被丢掉**（返回空串，`joinParts` 过滤掉）——
 * 比如没选夹子时「世界观夹子」那张卡就不该出现在 prompt 里，
 * 留一个「# 世界观夹子\n（无）」只会浪费 token 并让 AI 困惑。
 */
function fillCard(card, vars) {
    let text = String(card.text || '');
    let emptied = false;
    text = text.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
        const key = String(name).trim();
        const value = vars[key];
        if (value == null || String(value).trim() === '') {
            emptied = true;
            return '';
        }
        return String(value);
    });
    return emptied && !text.replace(/\s/g, '') ? '' : text.trim();
}

/**
 * 拼出所有可变值。
 *
 * @param {object} ctx  由 store 的 `generationContext()` 产出
 */
function buildVars(ctx = {}) {
    const identity = ctx.identity || {};
    const clips = asArray(ctx.clips).filter((c) => c && c.content);
    const prompts = asArray(ctx.prompts).filter((p) => p && p.content);

    return {
        世界观: [
            `名字：${identity.worldName || '未命名'}`,
            ctx.summary || '（这个世界观还没写简介，请按名字合理推测，但不要引入现实世界的品牌和地名。）',
        ].join('\n'),
        货币: identity.currency || '金币',
        世界类型: identity.mode || 'general',
        我: ctx.userDesc || `${identity.userName || '我'}（人设里没写更多）`,
        夹子: clips.length ? clips.map((c) => `【${c.title}】\n${c.content}`).join('\n\n') : '',
        附加提示词: prompts.length ? prompts.map((p) => `【${p.title}】\n${p.content}`).join('\n\n') : '',
        求职方向: String(ctx.aim || '').trim(),
    };
}

/** 按场景把卡片转成 parts */
function sceneParts(ctx, scene) {
    const vars = buildVars(ctx);
    const out = [];
    for (const card of cardsForScene(ctx.cards, scene)) {
        const text = fillCard(card, vars);
        if (!text) continue;
        out.push(part(card.id, card.title, text, { locked: card.locked }));
    }
    return out;
}

// ============================================================
// 职位列表
// ============================================================

const FEED_SHAPE = `{
  "items": [
    {
      "title": "职位名，4~12 字",
      "employer": "用人单位名，这个世界里的商号/机构/门派，3~10 字",
      "category": "从分类里挑一个",
      "jobType": "fulltime | parttime | gig | contract 之一",
      "payMode": "monthly | daily | tip 之一",
      "payText": "薪资的一句话描述，如「每月 2000」「日结 80~150」",
      "payAmount": 数字（月结填月薪，日结/打赏填单日上限）,
      "blurb": "一句话说清这活是干什么的，14~26 字",
      "ask": "对人的要求，一句话，12~24 字",
      "area": "在这个世界的哪一带，3~8 字",
      "tags": ["两到三个短标签，每个 2~4 字"]
    }
  ]
}`;

/**
 * 职位列表。
 *
 * 只生成列表不生成详情 —— 详情等用户真的点进去再生成。
 * 这是本 App 控 token 的主要手段：一次列表 8 条的成本远低于 8 份详情。
 */
export function buildFeedPrompt(ctx = {}) {
    const { category = '', exclude = [], size = FEED_SIZE } = ctx;
    const parts = sceneParts(ctx, SCENES.feed);

    const catLine = category && category !== '全部'
        ? `这一批只出「${category}」这一类的。`
        : `分类从这些里挑，每条挑一个：${JOB_CATEGORIES.filter((c) => c !== '全部').join('、')}。同一批里分类要有变化。`;

    const excludeLine = asArray(exclude).length
        ? `\n- 下面这些已经挂过了，这次全部换掉：${asArray(exclude).slice(0, 30).join('、')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `挂 ${size} 个正在招人的职位。\n`
        + `- ${catLine}\n`
        + '- 每个职位都必须能从上面的世界观设定中找到制度、产业或生活方式依据\n'
        + '- 演员、爱豆、电竞不是通用默认职业；世界观没有对应行业时绝对不要生成\n'
        + '- 不要为了凑熟悉职业把现代娱乐业、互联网公司或现实品牌硬塞进异世界\n'
        + '- 结算方式要有变化：多数是月结，也要有日结和纯打赏的\n'
        + '- ask 写具体的要求，不要「吃苦耐劳」这种放到哪儿都行的话'
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${FEED_SHAPE}`, { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 职位详情
// ============================================================

const DETAIL_SHAPE = `{
  "desc": "这份工作到底干什么，两到三段，每段 40~70 字",
  "duties": ["日常要做的事，3~5 条，每条 8~18 字"],
  "requires": ["硬性要求，2~4 条，每条 8~18 字"],
  "perks": ["待遇里除了钱之外的部分，2~4 条，每条 6~14 字"],
  "employerInfo": "用人单位是个什么来头，一段，40~70 字",
  "workTime": "上班时间的一句话描述",
  "process": ["招人流程，2~4 步，每步 4~10 字"],
  "voices": [
    { "who": "这个世界里的人名，2~4 字", "role": "他和这份工作的关系，如「干过两年」「隔壁摊的」", "text": "一句评价，20~40 字" }
  ]
}`;

export function buildDetailPrompt(ctx = {}) {
    const { job = {} } = ctx;
    const parts = sceneParts(ctx, SCENES.detail);
    const currency = ctx.identity?.currency || '金币';

    parts.push(part('target', '这个职位',
        [
            `职位：${job.title}`,
            `用人单位：${job.employer || '未知'}`,
            `分类：${job.category || ''}`,
            `地段：${job.area || ''}`,
            `薪资：${job.payText || `${fmtMoney(job.payAmount)} ${currency}`}`,
            `简介：${job.blurb || ''}`,
            `要求：${job.ask || ''}`,
        ].join('\n'),
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        '把上面这个职位展开成完整的招聘详情。\n'
        + '- 已知信息不要改，只做扩写\n'
        + '- duties 要写这份工作真正每天在做的事，不是抽象的职责描述\n'
        + '- voices 写 3 条，立场要不一样：有干得挺好的、有嫌累的、有旁观者说风凉话的\n'
        + '- 不要出现现实世界的东西',
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${DETAIL_SHAPE}`, { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// HR 人设
// ============================================================

const RECRUITER_SHAPE = `{
  "name": "这个世界里的人名，2~4 字",
  "title": "他在这家单位的头衔，3~8 字",
  "age": "年龄段，如「三十出头」",
  "look": "外形一句话，14~24 字",
  "persona": "性格与做派，两句，40~70 字",
  "tone": "说话方式，一句，14~26 字",
  "care": "他招人最看重什么，一句，12~24 字",
  "dislike": "什么样的人他一眼就否掉，一句，12~24 字",
  "opening": "他见到求职者说的第一句话，像在聊天软件里打字，20~50 字"
}`;

/**
 * HR 人设。
 *
 * 用户明确要求「hr 的人设是在用户进入求职详情页看完以后、
 * 确认跟 hr 聊天的时候才生成的」—— 所以这一步是**独立的一次调用**，
 * 不能和职位详情合并。合并的话，用户只是翻一翻列表就把每个 HR 都造了一遍。
 */
export function buildRecruiterPrompt(ctx = {}) {
    const { job = {} } = ctx;
    const parts = sceneParts(ctx, SCENES.recruiter);

    parts.push(part('target', '他要招的岗位',
        `职位：${job.title}\n用人单位：${job.employer || ''}\n简介：${job.blurb || ''}\n要求：${job.ask || ''}`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        '造一个负责这个岗位招人的人。\n'
        + '- 他是这个世界里的人，名字、头衔、说话方式都要对得上\n'
        + '- 给他一个具体的偏好和一个具体的雷点，不要「看重能力」这种废话\n'
        + '- opening 是他打招呼的第一句，要能看出他是什么人',
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${RECRUITER_SHAPE}`, { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 面试对话
// ============================================================

const TALK_SHAPE = `{
  "reply": "你这一轮说的话，两三句，像在聊天软件里打字",
  "decision": "pending | hire | reject 之一",
  "reason": "decision 不是 pending 时，一句真实的理由；pending 时留空字符串"
}`;

/**
 * 面试的一轮回复。
 *
 * 决定权来自实际对话，不再存在按职业保送。代码只负责工作数量硬上限和
 * 至少完成两轮有效交流；其余录用/拒绝必须能在 reason 里指出对话证据。
 */
export function buildTalkPrompt(ctx = {}) {
    const { job = {}, recruiter = {}, rounds = 0 } = ctx;
    const parts = sceneParts(ctx, SCENES.talk);

    parts.push(part('you', '你是谁',
        [
            `你是 ${recruiter.name || '招人的'}，${recruiter.title || ''}。`,
            recruiter.age && `年纪：${recruiter.age}`,
            recruiter.look && `外形：${recruiter.look}`,
            recruiter.persona && `性格：${recruiter.persona}`,
            recruiter.tone && `说话方式：${recruiter.tone}`,
            recruiter.care && `你招人最看重：${recruiter.care}`,
            recruiter.dislike && `你一眼否掉的：${recruiter.dislike}`,
        ].filter(Boolean).join('\n'),
        { locked: true }));

    parts.push(part('post', '你在招的岗位',
        `职位：${job.title}\n用人单位：${job.employer || ''}\n简介：${job.blurb || ''}\n要求：${job.ask || ''}\n薪资：${job.payText || ''}`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        `这是第 ${rounds + 1} 轮。回他一段话，同时给出你现在的决定。\n`
        + '- 第一轮只能继续了解或直接拒绝，不能当场录用；至少听到两次有效回答后才可 hire\n'
        + '- 还在了解他 → decision 给 pending\n'
        + '- 只有用户说出了与岗位要求直接相关的具体经验、能力或可信做法，才可以给 hire\n'
        + '- 不能因为用户来应聘、态度积极、想推动剧情就录用；人设与岗位明显不合就要 reject\n'
        + '- 决定要他 → hire，并在 reply 里说清楚依据、待遇和什么时候上工\n'
        + '- 决定不要 → reject，并在 reply 里给一句来自本次对话的真实理由\n'
        + '- reason 必须引用本次对话中影响判断的具体事实，不能只写「综合考虑」\n'
        + '- reply 里不要带任何括号旁白，就是他打出来的字',
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${TALK_SHAPE}`, { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 每日小剧场
// ============================================================

const THEATER_SHAPE = `{
  "title": "这一天的标题，6~14 字",
  "scenes": [
    {
      "place": "这一场在哪，3~8 字",
      "narration": "旁白，30~60 字，交代场景和动作",
      "lines": [
        { "speaker": "说话人的名字（必须是出场人物里的）", "text": "台词" }
      ]
    }
  ],
  "closing": "收尾，一到两句，20~40 字",
  "performance": {
    "level": "bad | poor | ok | good | great 之一",
    "note": "为什么给这个评级，一句，12~24 字",
    "bonus": 数字（剧情里真的有人额外给钱才填，否则填 0）
  }
}`;

/**
 * 每日小剧场。
 *
 * 每份工作有一段**自己的**小剧场提示词（`post.theaterPrompt`），
 * 用户可以在工作详情页里看到并改。它插在通用写法之后、任务之前 ——
 * 位置靠后是为了让它能覆盖前面的通用要求（同样的指令，后写的赢）。
 */
export function buildTheaterPrompt(ctx = {}) {
    const {
        post = {}, day = '', length = 'medium',
        colleagues = [], rivals = [], recentDigests = [], extra = '',
    } = ctx;
    const parts = sceneParts(ctx, SCENES.theater);
    const currency = ctx.identity?.currency || '金币';
    const userName = ctx.identity?.userName || '我';

    parts.push(part('job', '这份工作',
        [
            `职位：${post.title}`,
            post.company && `单位：${post.company}`,
            post.duty && `日常在做：${post.duty}`,
            post.place && `上班地点：${post.place}`,
            post.note && `补充：${post.note}`,
            `结算：${describePayForPrompt(post.pay, currency)}`,
        ].filter(Boolean).join('\n'),
        { locked: true }));

    const cast = [
        `${userName}（就是「我」，这段是从我的视角发生的）`,
        ...asArray(colleagues).map((c) => `${c.name}（同事${c.desc ? `，${c.desc}` : ''}）`),
        ...asArray(rivals).map((c) => `${c.name}（不对付${c.desc ? `，${c.desc}` : ''}）`),
    ];
    parts.push(part('cast', '出场的人', cast.join('\n'), { locked: true }));

    if (asArray(recentDigests).length) {
        parts.push(part('history', '前几天发生过什么',
            asArray(recentDigests)
                .map((d) => `${fmtDay(d.day)}：${d.text}`)
                .join('\n'),
            { locked: true }));
    }

    const own = String(post.theaterPrompt || '').trim();
    if (own) parts.push(part('own', '这份工作专属的要求', own));

    const words = { short: '300~500', medium: '600~900', long: '1200~1600' }[length] || '600~900';
    const levels = PERFORMANCE_LEVELS.map((l) => `${l.id}=${l.label}`).join('、');

    parts.push(part('task', '这次要做什么',
        `写 ${fmtDay(day)} 这一天上班时的一段小剧场，总字数 ${words} 字，分 2~3 场。\n`
        + `- 只写这一天。不要总结这一周，也不要预告明天\n`
        + `- 前几天发生过的事可以提，但那是过去时\n`
        + `- 最后给这一天一个表现评级：${levels}\n`
        + (extra ? `- 用户希望这天发生：${extra}\n` : ''),
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${THEATER_SHAPE}`, { locked: true }));

    return { text: joinParts(parts), parts };
}

function describePayForPrompt(pay = {}, currency) {
    if (pay.mode === 'monthly') return `月结，每月 ${pay.payDay || 1} 号发 ${fmtMoney(pay.amount)} ${currency}`;
    if (pay.mode === 'tip') return `没有底薪，全靠当天有没有人打赏，最多 ${fmtMoney(pay.dailyMax)} ${currency}`;
    return `日结，当天 ${fmtMoney(pay.dailyBase)}~${fmtMoney(pay.dailyMax)} ${currency}，看表现`;
}

// ============================================================
// 当天梗概
// ============================================================

/**
 * 当天工作梗概。
 *
 * 用户要求「生成小剧场的同时会有当天工作梗概，方便以后生成小剧场的时候读取」。
 * 所以它是**独立的一次调用**，产物存在 theater.digest 里，
 * 下次生成小剧场时作为 `recentDigests` 传回去。
 *
 * 为什么不直接把全文塞回去：一场小剧场几百上千字，攒一周就把上下文撑爆了。
 */
export function buildDigestPrompt(ctx = {}) {
    const { theater = {}, post = {} } = ctx;
    const parts = sceneParts(ctx, SCENES.digest);

    const body = asArray(theater.scenes)
        .map((s, i) => {
            const lines = asArray(s.lines).map((l) => `${l.speaker}：${l.text}`).join('\n');
            return `第${i + 1}场 · ${s.place || ''}\n${s.narration || ''}\n${lines}`;
        })
        .join('\n\n');

    parts.push(part('source', '这一天',
        `${post.title || ''} · ${fmtDay(theater.day)}\n标题：${theater.title || ''}\n\n${body}\n\n${theater.closing || ''}`,
        { locked: true }));

    parts.push(part('task', '这次要做什么',
        '把这一天压缩成两三句工作记录。这段会在以后生成小剧场时被读到，'
        + '所以要写清楚「留下了什么」。',
        { locked: true }));

    parts.push(part('format', '输出格式',
        '只输出这两三句话本身，不要引号，不要编号，不要任何解释。', { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 预览面板用
// ============================================================

/** 粗略 token 估算：中文约 1 字 1 token，拉丁约 4 字符 1 token */
export function estimateTokens(text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    return Math.round(cjk + (s.length - cjk) / 4);
}

/** 给预览面板用的一份带统计的 parts */
export function describeParts(parts) {
    return asArray(parts).map((p) => ({
        ...p,
        tokens: estimateTokens(p.text),
        preview: truncate(p.text, 120),
    }));
}

/**
 * 场景 → build 函数。管理页的「看看发出去长什么样」按这张表调。
 * ★ 用表而不是 switch：加一个场景漏改一处，表这边是 undefined 直接看得见。
 */
export const SCENE_BUILDERS = Object.freeze({
    [SCENES.feed]: buildFeedPrompt,
    [SCENES.detail]: buildDetailPrompt,
    [SCENES.recruiter]: buildRecruiterPrompt,
    [SCENES.talk]: buildTalkPrompt,
    [SCENES.theater]: buildTheaterPrompt,
    [SCENES.digest]: buildDigestPrompt,
});

/** 每份工作的小剧场专属 prompt 默认值 —— 入职时写进 post，之后用户随便改 */
export function defaultTheaterPrompt(post = {}) {
    return [
        `这份工作的日常是「${post.title || ''}」。`,
        '写小剧场时请注意：',
        '- 每天的事要有区别，不要重复昨天的套路',
        '- 让这份工作特有的细节出现：工具、行话、这一行的规矩',
        '- 「我」不是主角光环型的人，做得成做不成都要有理由',
    ].join('\n');
}
