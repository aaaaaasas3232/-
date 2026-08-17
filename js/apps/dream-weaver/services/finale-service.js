/**
 * 梦境编织 · 杀青梗
 *
 * ── 先说清楚原版是什么状态 ────────────────────────────────────────
 *
 * 原版这个功能是**断成两截**的:
 *
 *   A. 社交卡片面板(`showFinaleModal` → 微博/群聊/推特/影评/论坛五种卡)
 *      —— 这是唯一能点到的路径,但 `generateWeiboTopic` 之类**只造空壳**,
 *         注释写着「空白模板 - 用户自行填写」。所以用户看到的是一堆空卡,得自己一个字一个字打。
 *
 *   B. AI 杀青气泡(`createFinaleBubble` + `generateFinaleContent` + `generateFinaleComment`)
 *      —— prompt 写得很完整、解析也写了,**但全文件没有任何地方调用 `createFinaleBubble`**。
 *         配置弹窗里选的「角色 / 场景描述」写进了 `self.finaleCharId` / `finaleSceneDesc`,
 *         然后就没有然后了 —— 社交卡片路径根本不读这两个字段。
 *
 * ── 这里怎么做 ────────────────────────────────────────────────────
 *
 * UI 完全按 A 复原(五种卡、可手填、可增删、可收藏);
 * 同时把 B 那条断掉的线接回来 —— 卡片上多一个「AI 填充」,
 * 用 B 的 prompt 生成内容后**填进 A 的卡片结构**里。
 *
 * 也就是说:原版设计好但没接上的东西,这里接上了;原版的手填能力一点没少。
 */

import { generate } from './ai-service.js';
import { resolveCharacterName } from './prompt-builder.js';
import { makeId } from '../utils.js';

/** 模式 → 可用的卡片类型(照抄原版 `showFinaleModal` 24017-24029) */
export const FINALE_MODES = Object.freeze([
    { id: 'tv', label: '电视剧杀青', types: ['weibo', 'groupchat'] },
    { id: 'movie', label: '电影杀青', types: ['twitter', 'review'] },
    { id: 'novel', label: '小说完结', types: ['forum'] },
]);

/** 卡片类型名(原版 `getFinaleTypeName` 24163) */
export const FINALE_TYPE_NAMES = Object.freeze({
    weibo: '热搜词条',
    groupchat: '群聊',
    twitter: '推文',
    review: '影评',
    forum: '讨论帖',
});

export const FINALE_TYPE_ICONS = Object.freeze({
    weibo: 'zap',
    groupchat: 'chat',
    twitter: 'message',
    review: 'film',
    forum: 'note',
});

export function typesOfMode(mode) {
    return FINALE_MODES.find((m) => m.id === mode)?.types || ['weibo'];
}

// ============================================================
// 空白模板 —— 和原版一模一样,不带任何内容
// ============================================================

export function blankCard(type, book) {
    const title = book?.title || '本书';
    switch (type) {
        case 'weibo':
            return {
                id: makeId('topic'),
                title: `#${title}杀青#`,
                hot: '',
                posts: [blankWeiboPost()],
            };
        case 'groupchat':
            return {
                id: makeId('chat'),
                name: `${title}粉丝群`,
                memberCount: 500,
                messages: [blankGroupMessage()],
            };
        case 'twitter':
            return {
                id: makeId('tweet'),
                hashtag: `${title.replace(/\s+/g, '')}Wrap`,
                posts: [blankTweet()],
            };
        case 'review':
            return {
                id: makeId('review'),
                type: 'short',
                username: '',
                content: '',
                rating: 5,
                time: '刚刚',
            };
        case 'forum':
            return {
                id: makeId('forum'),
                title: `【讨论】${title}完结感想`,
                author: '',
                content: '',
                views: '0',
                time: '刚刚',
                replies: [],
            };
        default:
            return null;
    }
}

export const blankWeiboPost = () => ({ id: makeId('post'), username: '', content: '', time: '刚刚', comments: [] });
export const blankWeiboComment = () => ({ id: makeId('cmt'), username: '', content: '', time: '刚刚', replies: [] });
export const blankWeiboReply = () => ({ id: makeId('rep'), username: '', content: '' });
export const blankGroupMessage = () => ({ id: makeId('gmsg'), username: '', content: '' });
export const blankTweet = () => ({ id: makeId('tw'), username: '', handle: '', content: '', time: 'now' });
export const blankForumReply = () => ({ id: makeId('freply'), author: '', content: '', time: '刚刚' });

// ============================================================
// AI 填充 —— 把原版断掉的那条线接回来
// ============================================================

const MODE_DESC = {
    tv: '一部电视剧刚刚杀青',
    movie: '一部电影刚刚杀青/首映',
    novel: '一部小说刚刚完结',
};

const TYPE_BRIEF = {
    weibo: `微博热搜词条:一个话题 + 3~5 条博文,每条博文下面 1~3 条评论,评论下面偶尔有回复。
发博的是「剧里的演员」和路人,不是角色本人。要有杀青花絮感:提 NG、天气、盒饭、连轴转。`,
    groupchat: `剧组微信群聊:12~18 条消息,发言人是演员和工作人员(用角色名当昵称也行)。
有玩笑、有互相拆台、有人发红包、有人问杀青宴几点。口语,短句,别写成小作文。`,
    twitter: `推特:5~8 条海外粉丝/演员推文,中英夹杂,带 @handle。语气比微博更随意。`,
    review: `一篇影评:400 字左右,专业但不端着,有具体分析(节奏、表演、某场戏),不要通篇夸。`,
    forum: `论坛帖:一个主楼 + 6~10 条回复。有人吹有人踩,有人歪楼,楼中楼互相接话。`,
};

/**
 * AI 输出格式约定。
 *
 * 用 JSON 而不是自定义分隔符:卡片是嵌套结构(话题→博文→评论→回复),
 * 分隔符格式表达嵌套会很脆,少一个符号整段就解析歪。
 * 原版 `generateFinaleComment` 也是要求 JSON 的(只是它只要一条评论,结构简单)。
 */
function schemaOf(type) {
    switch (type) {
        case 'weibo':
            return `{"title":"#话题#","hot":"热度文案","posts":[{"username":"昵称","content":"博文","comments":[{"username":"昵称","content":"评论","replies":[{"username":"昵称","content":"回复"}]}]}]}`;
        case 'groupchat':
            return `{"name":"群名","memberCount":500,"messages":[{"username":"昵称","content":"消息"}]}`;
        case 'twitter':
            return `{"hashtag":"话题标签不带#","posts":[{"username":"显示名","handle":"@handle","content":"推文"}]}`;
        case 'review':
            return `{"username":"影评人名","rating":4,"content":"影评正文"}`;
        case 'forum':
            return `{"title":"帖子标题","author":"楼主","views":"1234","content":"主楼","replies":[{"author":"昵称","content":"回复"}]}`;
        default:
            return '{}';
    }
}

/**
 * 从 AI 回复里抠 JSON。
 *
 * 沿用原版 `generateFinaleComment` 的思路并加固:
 *   1. 剥掉 ```json 围栏
 *   2. 从第一个 `{` 到最后一个 `}` 截一段(模型爱在前后加解释)
 *   3. JSON.parse
 * 失败返回 null,由调用方给出「解析失败」而不是把乱码填进卡片。
 */
function parseJsonLoose(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}

/** 把 AI 给的对象套进空白模板 —— 缺字段用模板的默认值,多字段丢掉 */
function hydrateCard(type, data, book) {
    const base = blankCard(type, book);
    if (!data) return base;

    switch (type) {
        case 'weibo':
            return {
                ...base,
                title: data.title || base.title,
                hot: data.hot || '',
                posts: (Array.isArray(data.posts) ? data.posts : []).map((p) => ({
                    ...blankWeiboPost(),
                    username: p.username || '',
                    content: p.content || '',
                    comments: (Array.isArray(p.comments) ? p.comments : []).map((c) => ({
                        ...blankWeiboComment(),
                        username: c.username || '',
                        content: c.content || '',
                        replies: (Array.isArray(c.replies) ? c.replies : []).map((r) => ({
                            ...blankWeiboReply(),
                            username: r.username || '',
                            content: r.content || '',
                        })),
                    })),
                })),
            };
        case 'groupchat':
            return {
                ...base,
                name: data.name || base.name,
                memberCount: Number(data.memberCount) || base.memberCount,
                messages: (Array.isArray(data.messages) ? data.messages : []).map((m) => ({
                    ...blankGroupMessage(),
                    username: m.username || '',
                    content: m.content || '',
                })),
            };
        case 'twitter':
            return {
                ...base,
                hashtag: String(data.hashtag || base.hashtag).replace(/^#/, ''),
                posts: (Array.isArray(data.posts) ? data.posts : []).map((p) => ({
                    ...blankTweet(),
                    username: p.username || '',
                    handle: String(p.handle || '').replace(/^@/, ''),
                    content: p.content || '',
                })),
            };
        case 'review':
            return {
                ...base,
                username: data.username || '',
                content: data.content || '',
                rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
                type: String(data.content || '').length > 200 ? 'long' : 'short',
            };
        case 'forum':
            return {
                ...base,
                title: data.title || base.title,
                author: data.author || '',
                views: String(data.views || '0'),
                content: data.content || '',
                replies: (Array.isArray(data.replies) ? data.replies : []).map((r) => ({
                    ...blankForumReply(),
                    author: r.author || '',
                    content: r.content || '',
                })),
            };
        default:
            return base;
    }
}

/**
 * 让 AI 生成一张卡。
 *
 * @param {object} opts
 * @param {string} opts.type      weibo | groupchat | twitter | review | forum
 * @param {string} opts.mode      tv | movie | novel
 * @param {string} [opts.characterId]  'all' 或某个角色 id
 * @param {string} [opts.sceneDesc]    场景描述(用户在配置弹窗填的)
 * @returns {Promise<{ok:boolean, card?:object, error?:string, aborted:boolean}>}
 */
export async function generateFinaleCard(opts = {}) {
    const { type, mode = 'tv', characterId = 'all', sceneDesc = '', book, orderedChapters = [], chapter, library, signal, onChunk } = opts;

    const character = characterId && characterId !== 'all'
        ? (book.characters || []).find((c) => String(c.id) === String(characterId))
        : null;
    const who = character
        ? `重点围绕「${resolveCharacterName(character)}」这个角色(的扮演者)展开。`
        : '全员都可以出场,不要只写一个人。';

    const instruction = `杀青梗须知:
  - Principle: 把这本书当成${MODE_DESC[mode] || MODE_DESC.tv},写一段「戏外」的社交内容。
  - Behaviors:
    - ${TYPE_BRIEF[type] || ''}
    - ${who}
    - 角色名用书里的,演员名和网友昵称你自己编
    - 不要复述剧情梗概,这些人是看过的
${sceneDesc ? `    - 场景:${sceneDesc}\n` : ''}  - Output: 只输出一个 JSON 对象,不要任何解释、不要 markdown 围栏。
    格式:${schemaOf(type)}`;

    const result = await generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'finale',
        payload: { content: instruction },
        input: instruction,
        overrideUserTurn: instruction,
        temperature: 0.95,
        // 卡片要的是完整 JSON,流式中途都是半截,没法边生成边显示 —— 直接一次性拿
        stream: false,
        signal,
        onChunk,
    });

    if (!result.ok) return { ok: false, error: result.error, aborted: result.aborted };

    const data = parseJsonLoose(result.text);
    if (!data) {
        return { ok: false, aborted: false, error: 'AI 没有按 JSON 格式返回,再试一次通常就好了' };
    }
    return { ok: true, aborted: false, card: hydrateCard(type, data, book) };
}

/**
 * 给某条内容追一条 AI 评论。
 *
 * prompt 和输出格式沿用原版 `generateFinaleComment`(23654):要求
 * `{"user": "网名", "text": "评论内容"}`,解析失败时剥掉符号当纯文本 + 随机网名兜底。
 */
const FALLBACK_NAMES = ['小透明', '路人甲', '吃瓜群众', '围观者', '新粉丝', '老观众'];

export async function generateFinaleComment(opts = {}) {
    const { mode = 'tv', target = '', book, orderedChapters = [], chapter, library, signal } = opts;

    const scene = {
        tv: '一条电视剧杀青消息',
        movie: '一条电影首映/杀青消息',
        novel: '一条小说完结消息',
    }[mode] || '一条杀青消息';

    const instruction = `你是一个真实的社交媒体用户,正在刷到${scene}的动态。发表一条真实、有感情的评论。

【你看到的内容】
${target}

要求:
  - 20~40 字,口语,像真人随手打的
  - 可以吐槽、可以感慨、可以玩梗,不要客套
  - 只输出 JSON,不要任何解释:{"user": "网名", "text": "评论内容"}`;

    const result = await generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'finale-comment',
        payload: { content: instruction },
        input: instruction,
        overrideUserTurn: instruction,
        temperature: 1,
        stream: false,
        signal,
    });

    if (!result.ok) return { ok: false, error: result.error, aborted: result.aborted };

    const data = parseJsonLoose(result.text);
    if (data?.user && data?.text) {
        return { ok: true, aborted: false, comment: { username: String(data.user), content: String(data.text) } };
    }

    // 解析失败:剥掉花括号引号当纯文本,配一个随机网名(原版同款兜底)
    const clean = String(result.text || '').replace(/[{}"]/g, '').trim();
    if (clean.length > 5 && clean.length < 200) {
        const name = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)] + Math.floor(Math.random() * 100);
        return { ok: true, aborted: false, comment: { username: name, content: clean.slice(0, 100) } };
    }
    return { ok: false, aborted: false, error: '评论生成失败,再试一次' };
}
