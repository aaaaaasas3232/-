/**
 * 梦境编织 · Prompt 组装(唯一真相)
 *
 * ── 这个文件修的是原版最严重的一个 bug ──────────────────────────────
 *
 * 原版有**三条**互不相干的 prompt 组装路径:
 *
 *   | 函数 | 谁在用 | 结果 |
 *   |---|---|---|
 *   | `buildPrompt()` (20016)             | 正文生成 | 真正发出去的 |
 *   | `buildGenerationPrompt()` (20324)   | 重 roll / 扩写等工具 | 和上面不一样 |
 *   | `buildFullContextPreview()` (16734) | 「上下文管理」预览面板 | 和上面都不一样 |
 *
 * 于是产生了一个**用户完全无法理解**的现象:
 * 在预览面板里把「世界观」关掉、点保存、发送 —— 世界观照发不误。
 * 因为 `book.contextConfig` 那些开关只有 `buildFullContextPreview` 读,
 * `buildPrompt` 根本不认识它。用户以为自己在控制上下文,实际上什么都没控制。
 *
 * ── 现在的做法 ────────────────────────────────────────────────────
 *
 * 只有一个 `buildContextParts()`。它产出一组 part;
 * 预览面板渲染这组 part,发送时把同一组 part 交给
 * `composeContext()` 拼成文本。**两者是同一次调用的两个返回字段,
 * 物理上不可能不一致。**
 *
 *   const { text, parts, stats } = buildPrompt({ ... });
 *   //      ↑ 发给 AI      ↑ 给用户看
 *
 * 段落开关 = `book.contextConfig[sectionId]`,唯一入口,预览里点一下立刻影响发送。
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐项目里最好的那两段(`defaultReplyNote`,见 `docs/跨App注册Prompt指导方案.md` §5.1):
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的。
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条。**不铺陈背景** —— 上下文长度是有限的,
 * 多写一百行解释就等于把用户的正文挤掉一百行。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { CONTEXT_SECTIONS, POV_OPTIONS, VIEWPOINT_OPTIONS, NARRATIVE_OPTIONS, REPLY_DIRECTION_OPTIONS, GENERATE_MODE_OPTIONS, AUTHOR_STYLE_OPTIONS, resolveWordRange } from '../constants.js';
import { htmlToText, findById, isSameId } from '../utils.js';

const composer = createContextComposer({ namespace: 'dream-weaver' });

export { composer };

// ============================================================
// 小工具
// ============================================================

function labelOf(options, id, fallback = '') {
    const hit = options.find((o) => o.id === id);
    return hit ? hit.label : (fallback || id || '');
}

/** 把「键: 值」列表拼成一段,自动跳过空值 —— 空字段不该在 prompt 里留下 "年龄: " 这种噪音 */
function kvBlock(pairs) {
    return pairs
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${String(value).trim()}`)
        .join('\n');
}

function section(id) {
    return CONTEXT_SECTIONS.find((s) => s.id === id) || { id, tag: id, label: id };
}

// ============================================================
// 各段正文
// ============================================================

function buildSystemPart(library) {
    const base = library?.settings?.generationPrompts?.basePrompt || '';
    return `创作须知:
  - Principle: 你是这本书的共同作者,不是助手。直接写正文,不要解释你要写什么。
  - Behaviors:
    - 只输出小说正文,不要「好的」「以下是」这类前后缀
    - 不要写章节标题、不要加 markdown 标记
    - 严格遵守下面【叙事要求】里的人称、视角、手法和字数
    - 人物言行必须符合【角色设定】,不要临时给人物加设定
    - 承接【本章已有内容】的语气和节奏,不要另起炉灶
${base ? `\n${base.trim()}` : ''}`;
}

function buildUserIdentityPart(book) {
    if (!book.userIdentity) return '';
    const character = findById(book.characters, book.userIdentity);
    const name = resolveCharacterName(character);
    if (!name) return '';
    return kvBlock([
        ['我在这本书里扮演', name],
        ['身份', character?.role],
        ['设定', character?.description],
    ]) + `\n\n注意: 「我」发来的内容是这个角色的言行或作者指令,不要把「我」写成旁观者。`;
}

function buildSynopsisPart(book) {
    return String(book.synopsis || '').trim();
}

function buildWorldPart(book) {
    // 优先用绑定的世界观实体,没有就用书里自填的
    if (book.worldId) {
        const world = window.settingsSdk?.worlds?.get?.(book.worldId);
        if (world) {
            const keyPoints = Array.isArray(world.keyPoints) ? world.keyPoints : [];
            return kvBlock([
                ['世界', world.name],
                ['概要', world.summary || world.description],
                ['要点', keyPoints.length ? keyPoints.map((p) => `· ${p}`).join('\n') : ''],
            ]);
        }
    }
    if (book.customWorld?.name || book.customWorld?.description) {
        return kvBlock([
            ['世界', book.customWorld.name],
            ['设定', book.customWorld.description],
        ]);
    }
    return '';
}

/**
 * 解析角色显示名。
 *
 * ★ 修 bug:原版 `getCharacterInfo`(7067)只 handle `mask` / `ai`,
 *   `type: 'custom'` 落到 else 分支返回「未知角色」——
 *   而自定义角色是最常用的一种,等于大部分书的角色名在 prompt 里全是「未知角色」。
 */
export function resolveCharacterName(character) {
    if (!character) return '';
    if (character.type === 'custom') return character.name || '';
    // mask / ai 从人设 SDK 现取,取不到回落到存的快照
    const sdk = window.settingsSdk;
    if (character.type === 'ai') {
        const person = sdk?.aiPersons?.get?.(character.refId || character.id);
        if (person?.name) return person.name;
    } else if (character.type === 'mask') {
        const user = sdk?.users?.get?.(character.refId || character.id);
        if (user?.name) return user.name;
    }
    return character.name || '';
}

function buildCharactersPart(book) {
    const list = (book.characters || []).filter((c) => c.includeInPrompt !== false);
    if (list.length === 0) return '';
    return list
        .map((character) => {
            const name = resolveCharacterName(character) || '(未命名角色)';
            const detail = kvBlock([
                ['身份', character.role],
                ['设定', character.description],
            ]);
            return detail ? `【${name}】\n${detail}` : `【${name}】`;
        })
        .join('\n\n');
}

function buildLocationsPart(book) {
    const list = (book.locations || []).filter((l) => l.includeInPrompt !== false);
    if (list.length === 0) return '';
    return list
        .map((location) => (location.description ? `【${location.name}】${location.description}` : `【${location.name}】`))
        .join('\n');
}

function buildTimelinePart(book) {
    const events = (book.timelineEvents || []).filter((e) => e.includeInPrompt !== false);
    if (events.length === 0) return '';
    const lines = events.map((event) => {
        const time = event.time ? `[${event.time}] ` : '';
        const desc = event.description ? ` —— ${event.description}` : '';
        return `${time}${event.title}${desc}`;
    });
    const now = book.worldTime ? `\n\n当前故事时间: ${book.worldTime}` : '';
    return `已经发生的事(按时间线顺序):\n${lines.join('\n')}${now}`;
}

function buildAuthorStylePart(book, library) {
    if (!book.enableAuthorPersonality) return '';
    const style = labelOf(AUTHOR_STYLE_OPTIONS, book.authorStyle, '均衡');
    const summary = String(library?.styleSummary || '').trim();
    return kvBlock([
        ['文风', style],
        ['作者习惯', summary],
    ]);
}

function lengthRule(mode, wordRange) {
    const span = `${wordRange.min}-${wordRange.max} 字`;
    if (mode === 'sentence') return `${span},只写一两句就停,不要写成一段`;
    if (mode === 'chapter') return `${span},宁可写足也不要草草收尾`;
    return `${span},只写一段。这段的动作或氛围收住就停,不要另起下一段,不要写成一章`;
}

function buildNarrativePart(book, chapter, settings, wordRange) {
    const pov = chapter?.pov || settings.pov;
    const povCharacter = chapter?.povCharacterId ? findById(book.characters, chapter.povCharacterId) : null;
    const viewpointLabel = labelOf(VIEWPOINT_OPTIONS, settings.viewpoint);

    return `叙事要求:
  - Principle: 下面每一条都是硬约束,不符合就是写错了。
  - Behaviors:
    - 人称: ${labelOf(POV_OPTIONS, pov)}
    - 视角: ${viewpointLabel}${povCharacter ? `(限定在「${resolveCharacterName(povCharacter)}」的感知范围内,不要写他不可能知道的事)` : ''}
    - 叙事手法: ${labelOf(NARRATIVE_OPTIONS, settings.narrativeMethod)}
    - 侧重: ${labelOf(REPLY_DIRECTION_OPTIONS, settings.replyDirection)}
    - 生成粒度: ${labelOf(GENERATE_MODE_OPTIONS, settings.generateMode)}
    - 篇幅: ${lengthRule(settings.generateMode, wordRange)}`;
}

/**
 * 前情提要 = 之前所有章节里「勾了 useSummary 且写了 summary」的那些。
 *
 * 只取当前章之前的 —— 把后面章节的梗概喂给 AI 等于剧透,它会提前写出还没发生的事。
 */
function buildChapterSummariesPart(orderedChapters, currentChapterId) {
    const index = orderedChapters.findIndex((c) => isSameId(c.id, currentChapterId));
    const before = index >= 0 ? orderedChapters.slice(0, index) : orderedChapters;
    const lines = before
        .filter((chapter) => chapter.useSummary && String(chapter.summary || '').trim())
        .map((chapter) => `【${chapter.title}】${String(chapter.summary).trim()}`);
    return lines.join('\n');
}

/** 本章正文:把消息流按顺序拼成连续文本(note 类型不进正文) */
function buildChapterContextPart(chapter) {
    if (!chapter) return '';
    const body = chapter.messages
        .filter((message) => message.role !== 'note')
        .map((message) => htmlToText(message.content))
        .filter(Boolean)
        .join('\n\n');
    return body;
}

function buildCustomPromptsPart(book) {
    const list = (book.customPrompts || []).filter((p) => p.enabled !== false && String(p.content || '').trim());
    if (list.length === 0) return '';
    return list.map((p) => (p.title ? `【${p.title}】\n${p.content.trim()}` : p.content.trim())).join('\n\n');
}

// ============================================================
// 组装
// ============================================================

/**
 * 产出这次生成的全部上下文段落。
 *
 * **预览面板和发送共用这一个函数** —— 这是整个重写里最重要的一条约束。
 *
 * @param {object} ctx
 * @param {object} ctx.book
 * @param {object[]} ctx.orderedChapters  按目录顺序排好的全部章节
 * @param {object} ctx.chapter            当前章
 * @param {object} ctx.library            设置 / 风格总结
 * @param {{min:number,max:number}} [ctx.wordRange]
 * @returns {import('@/src/core/context-composer.js').ContextPart[]}
 */
export function buildContextParts(ctx = {}) {
    const { book, orderedChapters = [], chapter, library } = ctx;
    if (!book || !library) return [];

    const settings = library.settings;
    const wordRange = ctx.wordRange || resolveWordRange(settings);
    const config = book.contextConfig || {};

    const bodies = {
        system: buildSystemPart(library),
        userIdentity: buildUserIdentityPart(book),
        synopsis: buildSynopsisPart(book),
        world: buildWorldPart(book),
        characters: buildCharactersPart(book),
        locations: buildLocationsPart(book),
        timeline: buildTimelinePart(book),
        authorStyle: buildAuthorStylePart(book, library),
        narrative: buildNarrativePart(book, chapter, settings, wordRange),
        chapterSummaries: buildChapterSummariesPart(orderedChapters, chapter?.id),
        chapterContext: buildChapterContextPart(chapter),
        customPrompts: buildCustomPromptsPart(book),
    };

    return CONTEXT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        // locked 的段(系统指令 / 叙事要求)不给关 —— 关掉之后 AI 会开始写散文诗
        active: meta.locked ? true : config[meta.id] !== false,
        locked: meta.locked === true,
        source: meta.desc,
    }));
}

/**
 * 拼出最终 prompt。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}) {
    const parts = buildContextParts(ctx);
    const book = ctx.book;
    const scope = `${book?.id || 'none'}::${ctx.chapter?.id || 'none'}`;

    const result = composer.composeAndSave(scope, parts, {
        order: Array.isArray(book?.contextOrder) ? book.contextOrder : undefined,
        tokenBudget: Number(ctx.library?.settings?.contextTokenBudget) || 0,
    });
    return result;
}

/**
 * 拼「用户这一轮说了什么」。
 *
 * 和 system prompt 分开:system 是设定(每轮基本不变,便于服务端缓存),
 * 这一段才是本轮指令。原版把两者拼成一个巨大字符串塞进 system,
 * 既浪费缓存也让 AI 分不清「设定」和「现在要我干嘛」。
 */
export function buildUserTurn({ mode, input, wordRange }) {
    const text = String(input || '').trim();
    const template = mode?.promptTemplate || '{内容}';
    const range = wordRange || { min: 150, max: 350 };
    return template
        .replace(/\{内容\}/g, text)
        .replace(/\{min\}/g, String(range.min))
        .replace(/\{max\}/g, String(range.max))
        .trim();
}

/**
 * 工具类生成(重 roll / 扩写 / 内心视角 / 摘要)的指令段。
 *
 * ★ 原版这里是完全独立的第二条组装路径(`buildGenerationPrompt`),
 *   带的设定和正文生成不一样,导致「重 roll 出来的段落跟前后文对不上」。
 *   现在它只产出**这一段指令**,前面的世界观/角色/正文全部复用 `buildPrompt`,
 *   所以重 roll 看到的上下文和原本生成时**一模一样**。
 */
export function buildToolTurn({ kind, library, payload = {}, wordRange }) {
    const prompts = library?.settings?.generationPrompts?.typePrompts || {};
    const range = wordRange || resolveWordRange(library?.settings) || { min: 150, max: 350 };
    const instruction = prompts[kind] || prompts.continue || '请继续创作。';

    switch (kind) {
        case 'reroll':
            return `${instruction}\n\n【要重写的段落】\n${payload.content || ''}\n\n重写成 ${range.min}-${range.max} 字,只输出新版本正文。`;
        case 'expand':
            return `${instruction}\n\n【要扩写的段落】\n${payload.content || ''}\n\n扩写到 ${range.min}-${range.max} 字,保留原有情节走向,只输出扩写后的正文。`;
        case 'summary':
            return `请为下面这一章写一段梗概。\n\n【章节正文】\n${payload.content || ''}\n\n要求: 100 字以内,只讲发生了什么和人物关系变化,不要评价,不要「本章讲述了」这类开头。直接输出梗概。`;
        case 'innerView': {
            const who = payload.characterName || '主角';
            return `请把下面这段正文改写成「${who}」的内心视角。\n\n【原文】\n${payload.content || ''}\n\n要求: 只写${who}能感知到的和心里想的,${range.min}-${range.max} 字,只输出改写后的正文。`;
        }
        case 'selection':
            return `请重写下面这句/这段,保持它在上下文里的作用不变。\n\n【原句】\n${payload.content || ''}\n\n${payload.hint ? `【要求】${payload.hint}\n\n` : ''}只输出重写后的内容,不要解释。`;
        default:
            return instruction;
    }
}

/** 读上一次拼好的快照(用于「上次发出去的是什么」这类回看) */
export function readLastPrompt(bookId, chapterId) {
    return composer.load(`${bookId || 'none'}::${chapterId || 'none'}`);
}
