/**
 * 梦境编织 · 衍生创作生成器
 *
 * 小剧场 / 读者评论 / 杀青梗 / IF 线 —— 这四类的共同点是:
 * **基于本书的设定生成一段不进正文的内容**。
 *
 * 原版给每一类都写了一整套 `generateXxx` + `callXxxAPI` + `showXxxResult`
 * (光杀青梗就有 `generateWeibo*` / `generateGroup*` / `generateTwitter*` /
 * `generateMovieReview` / `generateForum*` 五套,加上各自的 render 和 bind,近三千行)。
 * 它们的差别其实只有**一段指令文本**。
 *
 * 这里收敛成一个 `runGenerator()`:上下文复用 `buildPrompt`(所以生成出来的东西
 * 认识书里的角色和设定),各类只提供自己那段指令。
 */

import { buildPrompt } from './prompt-builder.js';
import { generate } from './ai-service.js';
import { THEATER_TYPES, COMMENT_TYPES } from '../constants.js';
import { htmlToText, truncate } from '../utils.js';

/** 取本章正文(给需要「基于刚写的内容」生成的类型用) */
function chapterText(chapter, limit = 3000) {
    if (!chapter) return '';
    const body = chapter.messages
        .filter((m) => m.role !== 'note')
        .map((m) => htmlToText(m.content))
        .filter(Boolean)
        .join('\n\n');
    // 太长会把 token 吃光,而且这类生成本来也只需要「最近发生了什么」
    return body.length > limit ? body.slice(-limit) : body;
}

/**
 * 各类生成器的指令段。
 *
 * 写法统一成「须知 + Principle + Behaviors」—— 和项目里最好的那几段 prompt 对齐
 * (见 `docs/跨App注册Prompt指导方案.md` §5.1)。
 */
function buildInstruction({ group, item, chapter, book }) {
    const body = chapterText(chapter);

    if (group === 'theater') {
        return `小剧场须知:
  - Principle: ${item.prompt}这不是正文,是番外性质的片段,轻松一点。
  - Behaviors:
    - 用书里已有的角色,别新造人
    - 300-600 字,一个场景写透就够,不要铺情节
    - 直接给正文,不要标题、不要说明
${body ? `\n【最近写到这里】\n${truncate(body, 1200)}` : ''}`;
    }

    if (group === 'comment') {
        return `${item.label}须知:
  - Principle: ${item.prompt}
  - Behaviors:
    - 以读者身份说话,不要以作者身份解释
    - 有夸有挑刺,别一味吹
    - 每条前面加「@昵称:」,昵称自己编,要像真人
    - 8-15 条,一行一条
${body ? `\n【他们看的内容】\n${truncate(body, 1500)}` : ''}`;
    }

    if (group === 'finale') {
        const forms = {
            weibo: '微博:一条演员发的杀青博 + 8 条网友评论(带昵称和点赞数)',
            'group-chat': '剧组微信群聊:12-20 条消息,带发言人名字,有玩笑有互相拆台',
            twitter: '推特:海外粉丝的 8-10 条推文,中英夹杂,带话题标签',
            review: '影评:一篇 400 字左右的专业影评,克制,有具体分析',
            forum: '论坛楼中楼:一个主楼 + 10 条回复,有争论',
        };
        return `杀青梗须知:
  - Principle: 把这本书当成一部已经拍完杀青的剧,写${forms[item.id] || item.label}。
  - Behaviors:
    - 角色名用书里的,演员名自己编
    - 要有「戏外」的感觉:提拍摄花絮、NG、天气、盒饭这类
    - 不要复述剧情梗概,网友是看过的
    - 直接给内容,不要说明这是什么
【这部剧讲什么】
${book.synopsis || '(作者还没写梗概)'}`;
    }

    return item.prompt || '';
}

/**
 * 跑一个衍生生成器。
 *
 * @returns {Promise<{ok:boolean, text:string, error?:string, aborted:boolean}>}
 */
export async function runGenerator({
    group, item, book, orderedChapters, chapter, library, signal, onChunk,
}) {
    const instruction = buildInstruction({ group, item, chapter, book });
    if (!instruction) return { ok: false, text: '', aborted: false, error: '不认识这个生成器' };

    return generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'generator',
        // buildToolTurn 不认识 'generator',所以直接把指令当 payload.content 传进去 ——
        // 这里用 kind:'selection' 的模板会串味,索性走下面的 override
        payload: { content: instruction },
        input: instruction,
        signal,
        onChunk,
        // 衍生内容比正文更需要放开一点,温度调高
        temperature: 0.95,
        stream: library.settings.useStreamMode !== false,
        overrideUserTurn: instruction,
    });
}

/** 找一个生成器条目(按 group + id) */
export function findGeneratorItem(group, id) {
    // 杀青梗不在这里 —— 它是卡片面板(`components/modals-finale.js`),不走「选一个 prompt」这条路
    const list = { theater: THEATER_TYPES, comment: COMMENT_TYPES }[group] || [];
    return list.find((x) => x.id === id) || null;
}

/** 生成结果在历史里怎么显示 */
export function describeGenerator(group, item) {
    const groupLabel = { theater: '小剧场', comment: '读者评论', finale: '杀青梗', ifline: 'IF 线' }[group] || '生成';
    return item?.label ? `${groupLabel} · ${item.label}` : groupLabel;
}

/** 预览一下这次会带多少上下文(给「生成前看一眼」用) */
export function previewGeneratorContext(ctx) {
    return buildPrompt(ctx);
}
