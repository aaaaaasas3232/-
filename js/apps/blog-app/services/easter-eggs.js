/**
 * 氧气 · 隐藏彩蛋帖子（作者本人的帖子）
 *
 * ── 这是什么 ──────────────────────────────────────────────────────
 *   广场每次「换一批」，有一点点概率会混进来一条**作者本人**写的帖子。
 *   它在列表里和普通帖子长得一模一样（只有标签，看不到正文），
 *   点开才知道是谁写的。用户不一定刷得到 —— 这是故意的。
 *
 *   正文全部来自本文件，**永远不调 AI**，不新增任何数据表。
 *   本文件是空数组时，氧气的行为和没有这个功能时完全一样。
 *
 * ── 怎么加一条彩蛋（只需要写字）────────────────────────────────────
 *   1. 往下翻到 EGG_SOURCE 数组。
 *   2. 加一段用反引号（`）包起来的文字，末尾补一个逗号。就这样：
 *
 *          `今天把一个按钮往左挪了两像素。
 *          没有人会发现。`,
 *
 *      标签、体裁、时间、互动数全部会自动补上，不用管。
 *   3. 存盘、刷新页面、去广场点「换一批」。（想立刻看见见下面「怎么测」）
 *
 *   缩进随意：每行开头共同的空白会被自动去掉。
 *   正文里的空行会保留成段落，写多长都行。
 *
 * ── 想多写一点：可选的头部 ─────────────────────────────────────────
 *   正文前面可以加几行「键: 值」，写完空一行再写正文。全部可选：
 *
 *          `标签: 深夜 / 作者的话
 *          心情: 凌晨三点
 *          日期: 2026-03-02
 *          体裁: 短文
 *          评论: 路过的人：你也还没睡
 *
 *          正文从这里开始。`,
 *
 *   | 键                | 作用                                                |
 *   |-------------------|-----------------------------------------------------|
 *   | 标签 / tags       | 列表里露出来的就是它。用 / 、 , 分隔，最多 4 个       |
 *   | 标题 / title      | 氧气的列表不显示标题；没写标签时拿它当标签            |
 *   | 体裁 / type       | 长文 / 短文 / 碎碎念。不写就按正文长度自动判断        |
 *   | 心情 / mood       | 只在详情页那行小字右边安静地出现一下                  |
 *   | 日期 / date       | 列表里的时间标签。不写就按 id 生成一个稳定的「N 小时前」|
 *   | 评论 / comments   | 写成「名字：说的话」。可以写多行，也可以一条都不写     |
 *
 *   没写标签就自动补 EGG_FALLBACK_TAGS（列表只显示标签，不能是空卡）。
 *   头部只认上面这几个键：正文第一句就算带冒号（「今天想说：……」）也不会被误当成头部。
 *
 * ── 概率旋钮（都在下面的常量里，改完刷新即可）──────────────────────
 *   EGG_CHANCE          每批广场混进一条的概率，默认 0.15
 *   EGG_MAX_PER_FEED    一批最多几条，默认 1
 *   EGG_MIN_BATCH_GAP   两次彩蛋之间至少隔几批，默认 2
 *   EGG_MIN_FEED_SIZE   列表短于这个数就不塞（太显眼），默认 3
 *
 * ── 怎么测（不用等运气）────────────────────────────────────────────
 *   1. 浏览器控制台敲 `window.__oxEggForce = true`，再去广场点「换一批」：必出。
 *   2. 想指定某一条：`window.__oxEggForce = '深夜'`（按 id 片段匹配，
 *      id 可以用 `listEasterEggs()` 看，或者直接写整条 id）。
 *   3. 测完 `delete window.__oxEggForce` 恢复概率。
 *   4. 随机源是确定性的：种子 = 档案键 + 批次号，所以同一批掷出的结果永远一样，
 *      不会因为重新渲染而变卦，也不会每次打开 App 换一个答案。
 *   5. 读过的彩蛋在池子没见底之前不会再被抽到 —— 反复看同一条请用第 1、2 步。
 *
 * ── 边界 ──────────────────────────────────────────────────────────
 *   - id 从正文哈希来：正文不改，id 就不变，「读过」状态和收藏都留得住。
 *     改了正文等于换了一条新彩蛋（旧的那条会从缓存的列表里自动摘掉）。
 *   - 本文件不 import 任何浏览器 API，node 里可以直接跑。
 */

import { hashString } from '../utils.js';

// ============================================================
// 作者内容区 —— 要加彩蛋，改这一个数组就够了
// ============================================================

export const EGG_SOURCE = [

`标签: 深夜 / 作者的话
心情: 凌晨三点

昨天有人问我，这个软件是不是一个人做的。

是。`,

`标签: 小事
体裁: 碎碎念

今天把一个按钮往左挪了两像素，然后盯着看了很久。
没有人会发现。我知道就够了。`,

`标签: 命名 / 氧气
标题: 为什么叫氧气

一开始它叫别的名字，很长，很像一个正经的产品。

后来有天半夜改问题，改到手指发凉，突然想到人是要呼吸的。
表达也是。憋久了会难受。

第二天早上我把名字换掉了。`,

`标签: 房间 / 她
日期: 2026-03-02

她最早只是一个占位用的圆。
我本来打算后面换成正经的插画。

结果一直没换。现在她就是那样了，一颗毛茸茸的球，没有名字，也没有脸。
挺好的。`,

`标签: 想说的话
体裁: 长文

如果你正在读这一条，说明你把它刷出来了。这个概率不高。

我做这个软件的时候，想的不是让你多待一会儿。
是希望你哪天很闷的时候，有个地方可以把话放下 —— 不用被回应，也不用被点赞。

随笔是给你自己看的，房间是空的，黑匣子里装的是别人呼出来的气。
它们都不聪明，也不会催你。

好好吃饭，早点睡。`,

`标签: 更新 / 深夜
评论: 路过的人：你也还没睡
评论: 一个陌生人：这条我读了两遍

刚发了一版更新。改动很小，小到写不出更新日志。
但是列表滑起来顺了一点点。`,

`标签: 谢谢
心情: 平静

谢谢你把它装上，也谢谢你点开这一条。

我不知道你是谁，你也不知道我是谁。
但我们都在很晚的时候，还醒着。`,

`凌晨四点。窗外有鸟开始叫了。
我保存了一下，关掉电脑。`,

];

// ============================================================
// 概率旋钮
// ============================================================

/**
 * 每批广场混进一条彩蛋的概率。
 * 默认 0.15：一批 10 条大约每 6、7 次「换一批」遇上一次；
 * 再叠上 EGG_MIN_BATCH_GAP 的冷却，实际比这更稀 ——
 * 够「偶遇」，又不至于让人以为是常驻内容。
 */
export const EGG_CHANCE = 0.15;

/** 一批广场里最多混几条（设成 0 = 整个功能关掉） */
export const EGG_MAX_PER_FEED = 1;

/** 两次彩蛋之间至少隔几批：2 = 最快也要隔一批才可能再出现 */
export const EGG_MIN_BATCH_GAP = 2;

/** 列表短于这个数就不塞 —— 三条里蹦出一条彩蛋太像摆好的 */
export const EGG_MIN_FEED_SIZE = 3;

/** 没写标签时兜底用的标签（列表只显示标签，不能是空卡） */
export const EGG_FALLBACK_TAGS = Object.freeze(['作者的话']);

// ============================================================
// 固定身份 —— 彩蛋帖子永远挂在这个人名下
// ============================================================

/** 帖子记录里的 ownerType（区别于 external / user / ai） */
export const EGG_OWNER_TYPE = 'egg';

/** 彩蛋 id 前缀：广场 stub、blogPosts、评论都靠它认亲 */
export const EGG_ID_PREFIX = 'egg::';

/**
 * 作者本人的站内身份。
 * profileGenerated 在 store 里被写死成 true，所以点进主页永远不会去调 AI；
 * slot 固定，头像颜色不会因为记录先后而变。
 */
export const EGG_AUTHOR = Object.freeze({
    authorId: 'egg::author',
    name: '写这个的人',
    bio: '做了这个软件。偶尔在这里放一条，不常来。',
    personality: '话少，写完就走。',
    followers: 96,
    following: 3,
    slot: 0,
});

// ============================================================
// 文本格式解析
// ============================================================

/** 头部只认这些键，别的一律当正文（无原型对象：不会被 toString 这类键蹭到） */
const HEADER_KEYS = Object.assign(Object.create(null), {
    标签: 'tags', tag: 'tags', tags: 'tags',
    标题: 'title', title: 'title',
    体裁: 'type', 类型: 'type', type: 'type',
    心情: 'mood', mood: 'mood',
    日期: 'date', 时间: 'date', date: 'date',
    评论: 'comment', comment: 'comment', comments: 'comment',
});

const TYPE_ALIAS = Object.assign(Object.create(null), {
    长文: 'long', 长: 'long', long: 'long',
    短文: 'short', 短: 'short', short: 'short',
    碎碎念: 'murmur', 念: 'murmur', murmur: 'murmur',
});

/** 正文多长算长文 / 多短算碎碎念（没写体裁时按这个判） */
const LONG_CHARS = 220;
const MURMUR_CHARS = 48;

/** 一条彩蛋最多几个标签 / 几条预设评论 */
const TAG_CAP = 4;
const COMMENT_CAP = 8;

function clean(value, max) {
    const s = String(value ?? '').trim();
    return s.length > max ? s.slice(0, max) : s;
}

/** 去掉每行开头共同的缩进，让作者可以在数组里正常缩进 */
function dedent(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
    let min = Infinity;
    for (const line of lines) {
        if (!line.trim()) continue;
        const m = /^[ \t]*/.exec(line);
        min = Math.min(min, m ? m[0].length : 0);
    }
    if (!Number.isFinite(min) || min <= 0) return lines;
    return lines.map((line) => (line.trim() ? line.slice(min) : ''));
}

function splitTags(value) {
    return String(value ?? '')
        .split(/[/／、,，]+|\s{2,}/)
        .map((t) => clean(t, 12))
        .filter(Boolean)
        .slice(0, TAG_CAP);
}

/** 「名字：说的话」；没写名字也收，给一个中性的称呼 */
function parseComment(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const m = /^(.{1,12}?)\s*[:：]\s*(.+)$/.exec(raw);
    const authorName = m ? clean(m[1], 12) : '路过的人';
    const text = clean(m ? m[2] : raw, 120);
    if (!text) return null;
    return { authorName: authorName || '路过的人', text };
}

/** 2026-03-02 / 2026/3/2 → 「3月2日」；别的写法原样留着 */
function parseDateLabel(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
    if (!m) return clean(raw, 12);
    return `${Number(m[2])}月${Number(m[3])}日`;
}

function deriveType(body) {
    if (body.length >= LONG_CHARS) return 'long';
    if (body.length <= MURMUR_CHARS) return 'murmur';
    return 'short';
}

/** 一段原文 → 一条规范化记录（正文为空返回 null） */
function parseEntry(raw, index) {
    const lines = dedent(raw);
    const head = Object.create(null);
    const comments = [];

    let i = 0;
    while (i < lines.length && !lines[i].trim()) i += 1;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) break;
        const m = /^\s*([A-Za-z\u4e00-\u9fa5]{1,6})\s*[:：]\s*(.*)$/.exec(line);
        if (!m) break;
        const key = HEADER_KEYS[m[1].toLowerCase()];
        if (!key) break;
        if (key === 'comment') {
            const c = parseComment(m[2]);
            if (c && comments.length < COMMENT_CAP) comments.push(c);
        } else {
            head[key] = m[2];
        }
        i += 1;
    }
    while (i < lines.length && !lines[i].trim()) i += 1;

    const body = lines.slice(i).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!body) {
        console.warn(`[blog] 第 ${index + 1} 条彩蛋没有正文，已跳过`);
        return null;
    }

    const title = clean(head.title, 20);
    let tags = splitTags(head.tags);
    if (!tags.length && title) tags = splitTags(title);
    if (!tags.length) tags = [...EGG_FALLBACK_TAGS];

    return {
        id: `${EGG_ID_PREFIX}${hashString(body).toString(36)}`,
        tags,
        title,
        type: TYPE_ALIAS[clean(head.type, 6).toLowerCase()] || deriveType(body),
        mood: clean(head.mood, 8),
        dateLabel: parseDateLabel(head.date),
        body,
        comments,
    };
}

function freezeRecord(record) {
    Object.freeze(record.tags);
    record.comments.forEach(Object.freeze);
    Object.freeze(record.comments);
    return Object.freeze(record);
}

// ============================================================
// 对外接口
// ============================================================

let _cache = null;

/**
 * 全部彩蛋（解析一次缓存住，返回只读记录）。
 * 源数组为空 / 全是空正文时返回空数组 —— 调用方据此完全退回原行为。
 */
export function listEasterEggs() {
    if (_cache) return _cache;
    const seen = new Set();
    const list = [];
    (Array.isArray(EGG_SOURCE) ? EGG_SOURCE : []).forEach((raw, index) => {
        const record = parseEntry(raw, index);
        if (!record) return;
        // 正文一字不差的两条会撞 id，给后来的那条补个序号
        let id = record.id;
        let n = 2;
        while (seen.has(id)) { id = `${record.id}-${n}`; n += 1; }
        seen.add(id);
        record.id = id;
        list.push(freezeRecord(record));
    });
    _cache = Object.freeze(list);
    return _cache;
}

/** 这个 id 是不是一条彩蛋（广场 stub / 帖子 / 深链都靠它分流） */
export function isEasterEggId(id) {
    return String(id || '').startsWith(EGG_ID_PREFIX) && String(id) !== EGG_AUTHOR.authorId;
}

export function findEasterEggById(id) {
    const key = String(id || '');
    if (!key) return null;
    return listEasterEggs().find((e) => e.id === key) || null;
}

/**
 * 抽一条。
 * @param {Function} rng          取值 0~1 的随机源（store 传确定性的那个）
 * @param {{excludeIds?: string[]}} options  已经读过的不再抽，直到池子见底
 */
export function pickEasterEgg(rng, options = {}) {
    const list = listEasterEggs();
    if (!list.length) return null;
    const exclude = new Set((Array.isArray(options.excludeIds) ? options.excludeIds : []).map(String));
    const pool = list.filter((e) => !exclude.has(e.id));
    const use = pool.length ? pool : list;
    const raw = typeof rng === 'function' ? Number(rng()) : Math.random();
    const roll = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0;
    return use[Math.floor(roll * use.length)] || null;
}
