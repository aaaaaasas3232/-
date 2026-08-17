/**
 * 梦境编织 · IF 线生成
 *
 * prompt 照抄原版 `generateIfLineText`(14762)/ `continueIfLineText`(14905)/
 * `generateIfLineChatReply`(15080),只补了「假设」这一项 ——
 * 原版是拿底部输入框里没发出去的内容当「特别参考」(`options.pendingInput`),
 * 那个入口很隐蔽(得先在输入框里打字、再开 IF 面板才有),
 * 这里改成面板里一个显式的「假设」输入框。
 *
 * 另外原版对话模式**把章节内容传进来了却没用**(`chaptersContent` 参数一直没被拼进 prompt),
 * 所以 AI 聊天时其实不知道故事讲了什么。这里接上了 —— 走 `buildPrompt` 的完整上下文。
 */

import { generate } from './ai-service.js';
import { resolveCharacterName } from './prompt-builder.js';
import { htmlToText, truncate } from '../utils.js';

/** 本章及之前的正文(原版 `getChaptersContentForIfLine` 只取到当前章) */
function storySoFar(orderedChapters, currentChapterId, limit = 2500) {
    const index = orderedChapters.findIndex((c) => String(c.id) === String(currentChapterId));
    const upto = index >= 0 ? orderedChapters.slice(0, index + 1) : orderedChapters;
    const text = upto
        .map((chapter) => {
            const body = chapter.messages
                .filter((m) => m.role !== 'note')
                .map((m) => `${m.role === 'user' ? '[指令]' : '[内容]'}${htmlToText(m.content)}`)
                .join('\n');
            return body ? `【${chapter.title}】\n${body}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
    return text.length > limit ? text.slice(-limit) : text;
}

/**
 * 角色视角参考:本章 + 前一章里、属于这个角色的视角梗概。
 * 原版 `getCharacterViewsForIfLine`(14698)就是这个范围。
 */
function characterViews(orderedChapters, currentChapterId, characterId) {
    if (!characterId || characterId === 'narrator') return '';
    const index = orderedChapters.findIndex((c) => String(c.id) === String(currentChapterId));
    if (index < 0) return '';
    const start = Math.max(0, index - 1);
    const lines = [];
    for (let i = start; i <= index; i += 1) {
        const chapter = orderedChapters[i];
        const views = chapter?.chapterInfo?.characterViews || chapter?.characterViews || [];
        for (const view of views) {
            if (String(view.characterId) !== String(characterId)) continue;
            if (!view.summary) continue;
            lines.push(`【${chapter.title}角色视角】\n${view.summary}`);
        }
    }
    return lines.join('\n\n');
}

function characterBrief(book, characterId) {
    if (!characterId || characterId === 'narrator') return '';
    const character = (book.characters || []).find((c) => String(c.id) === String(characterId));
    if (!character) return '';
    const parts = [`姓名: ${resolveCharacterName(character)}`];
    if (character.role) parts.push(`身份: ${character.role}`);
    if (character.description) parts.push(`设定: ${character.description}`);
    return `\n\n【角色信息】\n${parts.join('\n')}`;
}

/** 文本模式:换个视角重述 / 假设另一条路 */
export async function generateIfText(opts = {}) {
    const {
        book, orderedChapters = [], chapter, library,
        characterId, characterName, povLabel, premise, signal, onChunk,
    } = opts;

    const story = storySoFar(orderedChapters, chapter?.id);
    const views = characterViews(orderedChapters, chapter?.id, characterId);
    const brief = characterBrief(book, characterId);

    const instruction = `请以「${characterName}」的视角,使用${povLabel}重新叙述下面这段故事。${brief}
${views ? `\n\n【角色视角参考】\n${views}` : ''}
${premise ? `\n\n【假设】\n${premise}\n(人物性格和世界规则不变,变的只有这一个选择)` : ''}

【故事内容】
${story || '(这本书还没有正文,那就从这个假设本身写起)'}

要求:
1. 保持故事基本情节(除非上面的【假设】明确改了某个选择)
2. 从该角色主观感受出发
3. 体现角色性格和说话方式
4. 增加内心独白和情感描写
5. 字数 300-600 字
6. 直接输出内容,不要前缀、不要标题`;

    return generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'ifline',
        payload: { content: instruction },
        input: instruction,
        overrideUserTurn: instruction,
        temperature: 0.95,
        stream: library.settings.useStreamMode !== false,
        signal,
        onChunk,
    });
}

/** 接着往下写 */
export async function continueIfText(opts = {}) {
    const { book, orderedChapters = [], chapter, library, characterName, povLabel, current, signal, onChunk } = opts;

    const instruction = `请继续下面这段「${characterName}」的${povLabel}视角内容,保持风格一致。

${truncate(current, 2000)}

要求: 继续 200-400 字,保持角色性格,直接输出续写内容(不要重复已有部分)。`;

    return generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'ifline-continue',
        payload: { content: instruction },
        input: instruction,
        overrideUserTurn: instruction,
        temperature: 0.95,
        stream: library.settings.useStreamMode !== false,
        signal,
        onChunk,
    });
}

/** 对话模式:以角色身份和用户私聊 */
export async function generateIfChatReply(opts = {}) {
    const {
        book, orderedChapters = [], chapter, library,
        characterId, characterName, history = [], signal, onChunk,
    } = opts;

    const views = characterViews(orderedChapters, chapter?.id, characterId);
    const brief = characterBrief(book, characterId);
    const transcript = history
        .map((m) => `${m.role === 'user' ? '用户' : characterName}:${m.content}`)
        .join('\n');

    const instruction = `你正在扮演「${characterName}」和用户私聊。${brief}
${views ? `\n\n【角色当前状态参考】\n${views}` : ''}

要求:
1. 完全代入角色身份回复
2. 回复简短自然,像真实聊天,不要写成小作文
3. 体现角色性格特点
4. 不要用括号描述动作
5. 直接输出回复内容

【对话记录】
${transcript}

请以「${characterName}」的身份回复最后一条消息。`;

    return generate({
        book,
        orderedChapters,
        chapter,
        library,
        kind: 'ifline-chat',
        payload: { content: instruction },
        input: instruction,
        overrideUserTurn: instruction,
        temperature: 0.95,
        stream: library.settings.useStreamMode !== false,
        signal,
        onChunk,
    });
}
