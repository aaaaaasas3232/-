/**
 * 四叶草 · 提示词组装（唯一真相）
 *
 * ── 一条硬规矩 ────────────────────────────────────────────────────
 *
 * 每个 build* 都返回 `{ text, parts }`：
 *   `text`  发给 AI 的那一份
 *   `parts` 预览面板渲染的那一份
 *
 * 是**同一次调用的两个返回字段**，不是两个函数。
 * 梦境编织原型最严重的 bug 就是「预览和发送是两条路径」——
 * 用户在预览里关掉世界观、保存、发送，世界观照发不误，而且不报任何错。
 * 只要是两个函数，无论一开始写得多一致，都会分叉；这是时间问题不是能力问题。
 *
 * ── 世界观是必传的 ────────────────────────────────────────────────
 *
 * 简介 + 资金映射（货币名）两段**永远在**，用户不能在预览里关掉它们。
 * 关掉的话 AI 会生成一堆和世界观无关的东西，那这个 App 就没有意义了。
 * 可关的是「夹子」「prompt 库条目」「口味」这三段。
 */

import { JSON_RULE, FEED_SIZE, PRODUCT_CATEGORIES, STORE_CATEGORIES } from '../constants.js';
import { asArray, fmtMoney, truncate } from '../utils.js';

/**
 * 一段上下文。
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
// 世界观底座 —— 所有生成都以它开头
// ============================================================

/**
 * @param {object} ctx
 * @param {object} ctx.identity   world-context.readIdentity() 的结果
 * @param {object[]} ctx.clips    选中的夹子
 * @param {object[]} ctx.prompts  选中的 prompt 库条目
 * @param {string} ctx.taste      用户补充的口味
 * @param {string} ctx.summary    世界观简介
 * @returns {Part[]}
 */
export function buildWorldParts(ctx = {}) {
    const { identity = {}, clips = [], prompts = [], taste = '', summary = '' } = ctx;
    const currency = identity.currency || '金币';

    const out = [];

    out.push(part('role', '你的角色',
        `你在为一个叫「四叶草」的购物软件生成内容。这个软件活在下面这个世界里，`
        + `它卖的每一样东西、每一家店都必须是这个世界里真的会有的东西。`
        + `不要出现现实世界的品牌名、现实地名、现实货币。`
        + `不要色情商品，不要把商品写成身材或性暗示营销。`,
        { locked: true }));

    out.push(part('world', `世界观：${identity.worldName || '未命名'}`,
        summary || '（这个世界观还没写简介，请按名字合理推测，但不要引入现实世界的品牌和地名。）',
        { locked: true }));

    // ★ 资金映射：规定了用什么交易，所有标价就得是它
    out.push(part('currency', '资金映射',
        `这个世界的通用货币叫「${currency}」。\n`
        + `- 所有价格都用「${currency}」计价，只给数字，不要带单位符号，不要写「元」「块」「$」。\n`
        + `- 定价要符合这个世界的物价水平：日常小物几十到几百，贵重物品上千。\n`
        + `- 同一批里要有便宜的也有贵的，不要全是一个价位。`,
        { locked: true }));

    const clipList = asArray(clips).filter((c) => c && c.content);
    if (clipList.length) {
        out.push(part('clips', '世界观夹子',
            clipList.map((c) => `【${c.title}】\n${c.content}`).join('\n\n')));
    }

    const promptList = asArray(prompts).filter((p) => p && p.content);
    if (promptList.length) {
        out.push(part('prompts', '附加提示词',
            promptList.map((p) => `【${p.title}】\n${p.content}`).join('\n\n')));
    }

    if (String(taste || '').trim()) {
        out.push(part('taste', '用户偏好', String(taste).trim()));
    }

    return out;
}

// ============================================================
// 列表生成
// ============================================================

const PRODUCT_SHAPE = `{
  "items": [
    {
      "name": "商品名，6~14 字",
      "brand": "这个世界里的店铺或作坊名，4~8 字",
      "category": "从分类里挑一个",
      "price": 数字,
      "originalPrice": 数字或 null（有折扣才给，且必须大于 price）,
      "blurb": "一句话卖点，14~24 字，别写成广告词",
      "tags": ["两到三个短标签，每个 2~4 字"]
    }
  ]
}`;

const STORE_SHAPE = `{
  "items": [
    {
      "name": "店名，4~10 字",
      "category": "从分类里挑一个",
      "area": "这个世界里的街区/地段名，3~8 字",
      "priceLevel": 人均消费数字,
      "rating": 3.5 到 5.0 之间一位小数,
      "serve": ["dinein" 和/或 "delivery"],
      "blurb": "一句话说清这家店的气质，14~24 字",
      "signature": "招牌那一道，4~10 字",
      "tags": ["两到三个短标签"]
    }
  ]
}`;

/**
 * 商品 / 店铺列表。
 *
 * 只生成列表不生成详情 —— 详情等用户真的点进去再生成。
 * 这是本 App 控 token 的主要手段：一次列表 8 条的成本远低于 8 份详情。
 */
export function buildFeedPrompt(ctx = {}) {
    const { kind = 'product', category = '', exclude = [], size = FEED_SIZE } = ctx;
    const isProduct = kind === 'product';
    const parts = buildWorldParts(ctx);

    const categories = isProduct ? PRODUCT_CATEGORIES : STORE_CATEGORIES;
    const catLine = category && category !== '全部'
        ? `这一批只出「${category}」这个分类的。`
        : `分类从这些里挑，每条挑一个：${categories.filter((c) => c !== '全部').join('、')}。同一批里分类要有变化。`;

    const excludeLine = asArray(exclude).length
        ? `\n- 下面这些已经出现过，这次全部换掉：${asArray(exclude).slice(0, 30).join('、')}`
        : '';

    parts.push(part('task', '这次要做什么',
        `列出 ${size} ${isProduct ? '件商品' : '家店'}。\n`
        + `- ${catLine}\n`
        + `- 名字要具体，不要「优质商品」「特色小吃」这种；一看就知道是哪个世界的东西\n`
        + `- ${isProduct ? '价格分布拉开，最贵的至少是最便宜的 5 倍' : '人均消费分布拉开'}\n`
        + `- blurb 写得像店家自己写的，不要「精心打造」「品质之选」这类空话`
        + excludeLine,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${isProduct ? PRODUCT_SHAPE : STORE_SHAPE}`,
        { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 详情生成
// ============================================================

const PRODUCT_DETAIL_SHAPE = `{
  "desc": "商品描述，两到三段，每段 40~70 字，写清材质/做工/用起来什么感觉",
  "specs": [{ "label": "规格名", "value": "值" }],
  "params": [{ "label": "参数名", "value": "值" }],
  "shipping": "配送说明，一句话",
  "reviews": [
    { "user": "这个世界里的人名，2~4 字", "rating": 3 到 5 的整数, "text": "评价，20~40 字", "when": "相对时间，如「三天前」" }
  ],
  "related": ["两到三个搭配建议，每个 6~12 字"]
}`;

const STORE_DETAIL_SHAPE = `{
  "desc": "店铺介绍，两到三段，每段 40~70 字，写清环境/来历/招牌",
  "hours": "营业时间，一句话",
  "address": "这个世界里的详细地址",
  "phone": "这个世界里合理的联络方式（可以是信鸽编号、传讯符编号之类）",
  "menu": [
    { "name": "菜名/单品名", "price": 数字, "desc": "12~20 字", "signature": true 或 false }
  ],
  "reviews": [
    { "user": "人名", "rating": 3 到 5 的整数, "text": "评价，20~40 字", "when": "相对时间" }
  ]
}`;

/**
 * 详情页。用户点进某一张卡才调，所以它可以贵一点。
 */
export function buildDetailPrompt(ctx = {}) {
    const { kind = 'product', item = {} } = ctx;
    const isProduct = kind === 'product';
    const parts = buildWorldParts(ctx);
    const currency = ctx.identity?.currency || '金币';

    const known = isProduct
        ? `名称：${item.name}\n店家：${item.brand || '未知'}\n分类：${item.category || ''}\n售价：${fmtMoney(item.price)} ${currency}\n卖点：${item.blurb || ''}`
        : `店名：${item.name}\n分类：${item.category || ''}\n地段：${item.area || ''}\n人均：${fmtMoney(item.priceLevel)} ${currency}\n招牌：${item.signature || ''}\n气质：${item.blurb || ''}`;

    parts.push(part('target', isProduct ? '这件商品' : '这家店', known, { locked: true }));

    parts.push(part('task', '这次要做什么',
        `把上面这${isProduct ? '件商品' : '家店'}展开成详情页。\n`
        + `- 已知信息不要改，只做扩写\n`
        + `- ${isProduct ? '规格和参数要符合这个世界的技术水平' : '菜单价格要和人均消费对得上，招牌那一道标 signature:true'}\n`
        + `- 评价写 3 条，语气要不一样：有满意的、有挑剔的、有说了半天没说重点的\n`
        + `- 评价里不要出现现实世界的东西`,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${isProduct ? PRODUCT_DETAIL_SHAPE : STORE_DETAIL_SHAPE}`,
        { locked: true }));

    return { text: joinParts(parts), parts };
}

// ============================================================
// 小剧场
// ============================================================

const THEATER_SHAPE = `{
  "title": "标题，6~12 字",
  "scenes": [
    {
      "place": "这一场发生在哪，4~8 字",
      "narration": "旁白，30~60 字，交代场景和动作",
      "lines": [
        { "speaker": "说话人的名字（必须是上面列出的人之一）", "text": "台词" }
      ]
    }
  ],
  "closing": "收尾，一到两句，20~40 字"
}`;

/**
 * 小剧场。
 *
 * 结构化成 scenes/lines 而不是一大坨文本，有两个原因：
 *   1. 用户要能**改**其中一句、能重 roll 某一场
 *   2. 将来的「情景聊天」App 要把这些台词接着往下演，
 *      它需要知道每一句是谁说的 —— 纯文本就得再解析一次
 */
export function buildTheaterPrompt(ctx = {}) {
    const {
        occasion = 'purchase', subject = {}, participants = [], length = 'medium',
        userDesc = '', extra = '',
    } = ctx;
    const parts = buildWorldParts(ctx);
    const currency = ctx.identity?.currency || '金币';
    const userName = ctx.identity?.userName || '我';

    const cast = [
        `${userName}（用户本人${userDesc ? `，${userDesc}` : ''}）`,
        ...asArray(participants).map((p) => `${p.name}${p.desc ? `（${p.desc}）` : ''}`),
    ];

    parts.push(part('cast', '出场的人', cast.join('\n'), { locked: true }));

    const occasionText = {
        purchase: `${userName} 买的东西送到了。`,
        dinein: `${userName} 和大家一起到店里。`,
        delivery: `${userName} 点的外送送到门口了。`,
        'gift-out': `${userName} 把礼物送给对方。`,
        'gift-in': `对方送了 ${userName} 一样东西。`,
    }[occasion] || `${userName} 有了一件新东西。`;

    const subjectText = subject?.name
        ? `${subject.name}${subject.price ? `（${fmtMoney(subject.price)} ${currency}）` : ''}${subject.blurb ? `\n${subject.blurb}` : ''}`
        : '（没有具体物品）';

    parts.push(part('scene', '这一场的由头',
        `${occasionText}\n涉及的东西：\n${subjectText}${extra ? `\n补充：${extra}` : ''}`,
        { locked: true }));

    const words = { short: '300~500', medium: '600~900', long: '1200~1600' }[length] || '600~900';

    parts.push(part('task', '这次要做什么',
        `写一场小剧场，总字数 ${words} 字，分 2~3 场。\n`
        + `- 每个人说话要像他自己，性格差异要能从台词里看出来\n`
        + `- 别让所有人都夸这个东西，可以有人不感兴趣、有人跑题\n`
        + `- 旁白只写看得见的东西，不要替角色解释心理活动\n`
        + `- 不要写成商品软文，这是一段生活片段，商品只是由头\n`
        + `- speaker 只能用上面列出的名字，不要凭空加人`,
        { locked: true }));

    parts.push(part('format', '输出格式',
        `${JSON_RULE}\n结构：\n${THEATER_SHAPE}`,
        { locked: true }));

    return { text: joinParts(parts), parts };
}

/**
 * 小剧场概要。
 *
 * 为什么要单独一步：小剧场本身几百上千字，整篇塞进 murmur 的上下文
 * 会把用户真正的聊天记录挤掉。注册到 murmur 的是概要，不是全文。
 */
export function buildTheaterSummaryPrompt(theater = {}) {
    const scenes = asArray(theater.scenes)
        .map((s, i) => {
            const lines = asArray(s.lines).map((l) => `${l.speaker}：${l.text}`).join('\n');
            return `第${i + 1}场 · ${s.place || ''}\n${s.narration || ''}\n${lines}`;
        })
        .join('\n\n');

    const parts = [
        part('source', '这场小剧场',
            `标题：${theater.title || ''}\n\n${scenes}\n\n${theater.closing || ''}`,
            { locked: true }),
        part('task', '这次要做什么',
            '用两句话概括这段发生了什么。\n'
            + '- 第一句说事：谁、因为什么、在哪\n'
            + '- 第二句说人：谁的反应值得记住\n'
            + '- 这段概要会给 AI 当记忆用，所以要写「发生过什么」，不要写「这段写得怎么样」\n'
            + '- 不要复述台词原文',
            { locked: true }),
        part('format', '输出格式', '只输出这两句话本身，不要引号，不要编号，不要任何解释。', { locked: true }),
    ];

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
