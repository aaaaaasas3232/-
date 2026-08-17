/**
 * 小奇怪 · 匿名三件套的 AI 层
 *
 * 三个页面(回答箱 / 收信箱 / 漂流瓶)共用同一套「拉名单 → 逐个发请求 →
 * 清洗文本」的流程,唯一不同的是 prompt 怎么拼。所以流程收在这里,
 * prompt 也收在这里,组件只负责「什么时候调、结果放哪儿」。
 *
 * ── 三个页面的匿名方向是**相反**的,别写混 ────────────────────────
 *
 *   回答箱  AI → 用户。AI 知道用户是谁(带人设卡),用户不知道是哪个 AI。
 *   收信箱  用户 → AI。AI 不知道来信人是谁(**不带人设卡**),用户知道自己写给谁。
 *   漂流瓶  多对多。谁都不知道对面是谁,配对由 JS 一次性算死。
 *
 * ★ 收信箱那条是这三件事里最容易写错的:顺手把 `describePlayer(playerCard)`
 *   拼进去,AI 就会在回信里叫出用户的名字 —— 玩法当场塌掉,而且不报错。
 *   所以本文件里**只有** `buildAskboxSystem()` 碰 playerCard,
 *   其余两个函数连这个参数都不接。
 *
 * ── 失败怎么办 ────────────────────────────────────────────────────
 *
 * 和 ai-service 一样:**永不抛异常**。批量召唤里某个座位挂了就跳过那个座位,
 * 剩下的照常出结果(AGENTS.md §7「失败跳过该座位」)。
 */

import { ANON, ANON_ALPHABET } from '../constants.js';
import { asArray, shuffle, truncate, makeId } from '../utils.js';
import { generate } from './ai-service.js';
import * as nook from './nook-bridge.js';

// ============================================================
// 名单与代号
// ============================================================

/**
 * 当前世界观下能参与的 AI。
 *
 * ★ 走 `listWorldAis()` 而不是 `listSeatCandidates()` —— 后者不传 world
 *   时会返回**所有**世界观的角色(见 nook-bridge 里的注释)。
 */
export function roster() {
    return nook.listWorldAis().slice(0, ANON.maxRoster);
}

export function worldName() {
    const world = nook.getWorld('', nook.getPlayerCard(''));
    return String(world?.name || '');
}

/**
 * 给一批人发代号。
 *
 * 打乱之后再发 —— 按名单顺序发的话,「A 永远是列表里第一个 AI」,
 * 用户点两次就能把代号和真身对上。
 */
export function mintAliases(count) {
    const n = Math.max(0, Math.min(Number(count) || 0, ANON_ALPHABET.length));
    return shuffle(ANON_ALPHABET).slice(0, n).map((ch) => `匿名用户${ch}`);
}

// ============================================================
// 文本清洗
// ============================================================

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|\u{200D}/gu;

/**
 * 把模型输出洗成「能直接显示的一段话」。
 *
 * 做四件事:剥引号 / 剥「AI 名字:」前缀 / 按设置去 emoji / 截断。
 * 前缀那条是必要的 —— 模型很爱回「顾漾:……」,而在匿名页面里
 * **那个前缀就是身份泄漏**。
 */
export function cleanLine(raw, { disableEmoji = true, max = ANON.textMax, names = [] } = {}) {
    let text = String(raw ?? '').trim();
    if (!text) return '';
    text = text.replace(/^```[a-z]*\s*/i, '').replace(/```$/, '').trim();
    for (const name of asArray(names)) {
        if (!name) continue;
        const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`^\\s*${escaped}\\s*[::]\\s*`), '');
    }
    text = text.replace(/^["'“”‘’「『]+/, '').replace(/["'“”‘’」』]+$/, '').trim();
    if (disableEmoji) text = text.replace(EMOJI_RE, '');
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return text.length > max ? text.slice(0, max) : text;
}

// ============================================================
// prompt 片段
// ============================================================

function commonRules(disableEmoji) {
    return [
        '不要写旁白、动作描写、括号补充,只说话本身。',
        '不要在开头写自己的名字或任何称呼前缀。',
        disableEmoji ? '不要使用任何 emoji 或颜文字。' : '',
    ].filter(Boolean);
}

function personaBlock(ai) {
    return [`你是【${ai?.name || 'AI'}】。`, nook.describeAi(ai)].filter(Boolean).join('\n');
}

function worldBlock() {
    const world = nook.getWorld('', nook.getPlayerCard(''));
    const desc = nook.describeWorld(world);
    return desc ? `你所在的世界:\n${desc}` : '';
}

function extraBlock(custom) {
    const text = String(custom || '').trim();
    return text ? `补充设定:\n${text}` : '';
}

// ============================================================
// 回答箱：AI 匿名向用户提问
// ============================================================

function buildAskboxSystem(ai, { custom, disableEmoji }) {
    const player = nook.getPlayerCard('');
    const playerDesc = nook.describePlayer(player);
    return [
        personaBlock(ai),
        worldBlock(),
        playerDesc ? `你要提问的对象:\n${playerDesc}` : '',
        extraBlock(custom),
        '',
        '场景:这个世界有一只「匿名回答箱」。所有人都可以往里投一个问题,'
        + '被问的人能看到问题、能回答,但**永远不会知道是谁投的**。',
        '现在轮到你投一个问题给 TA。',
        '',
        '要求:',
        '- 问一件你**真的**想知道、平时当面不好开口的事。',
        '- 一句话,45 字以内,用问号结尾。',
        '- 不要暴露只有你会知道的细节,那等于署名。',
        ...commonRules(disableEmoji).map((r) => `- ${r}`),
        '- 直接输出这个问题,不要任何其他内容。',
    ].filter((line) => line !== null && line !== undefined).join('\n');
}

/** 让一个 AI 想一个想问用户的问题 */
export async function askQuestion(ai, seatIndex = 0, opts = {}) {
    const apiRef = nook.resolveApiRefFor(ai, seatIndex);
    if (!apiRef) return { ok: false, text: '', error: nook.describeMissingApi() };

    const res = await generate({
        apiRef,
        systemPrompt: buildAskboxSystem(ai, opts),
        userTurn: opts.avoid
            ? `（请重新想一个问题。不要再问和这句意思相近的:「${truncate(opts.avoid, 60)}」）`
            : '（请投出你的匿名提问）',
        temperature: 1,
        signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: res.error || '这一位没有回应' };

    const text = cleanLine(res.text, { disableEmoji: opts.disableEmoji, max: 120, names: [ai?.name] });
    return text ? { ok: true, text, error: '' } : { ok: false, text: '', error: 'AI 返回了空内容' };
}

/** 用户回答之后,这个 AI 接着说 */
export async function askboxFollowUp(ai, question, opts = {}) {
    const apiRef = nook.resolveApiRefFor(ai, opts.seatIndex || 0);
    if (!apiRef) return { ok: false, text: '', error: nook.describeMissingApi() };

    const system = [
        buildAskboxSystem(ai, opts),
        '',
        '你投出的问题是:',
        question?.text || '',
        '',
        '对方已经回答了。你要接着聊下去,但仍然是匿名的 ——',
        '不要自报家门,不要提只有你俩之间才有的往事。',
        '一到两句话,60 字以内。',
    ].join('\n');

    const res = await generate({
        apiRef,
        systemPrompt: system,
        userTurn: renderThread(question?.thread, { meLabel: '对方', themLabel: '你' }),
        temperature: 0.95,
        signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: res.error || '这一位没有回应' };

    const text = cleanLine(res.text, { disableEmoji: opts.disableEmoji, max: 200, names: [ai?.name] });
    return text ? { ok: true, text, error: '' } : { ok: false, text: '', error: 'AI 返回了空内容' };
}

// ============================================================
// 收信箱：用户匿名去问 AI
// ============================================================

/**
 * ★ 这个函数**不接** playerCard,也不调 `getPlayerCard()`。
 *   收信箱的全部意义就是「AI 不知道是谁写的」。
 */
function buildLetterboxSystem(ai, { custom, disableEmoji }) {
    return [
        personaBlock(ai),
        worldBlock(),
        extraBlock(custom),
        '',
        '场景:你的信箱里收到了一封**匿名来信**。',
        '寄信人没有署名,你不知道 TA 是谁 —— 可能是熟人,也可能是完全的陌生人。',
        '',
        '要求:',
        '- 你**确实不知道**寄信人是谁。不要猜到具体某个人头上,更不要直接叫出名字。',
        '- 按你自己的性格回信:该警惕就警惕,该动容就动容。',
        '- 两到四句话,120 字以内。',
        ...commonRules(disableEmoji).map((r) => `- ${r}`),
        '- 直接输出回信正文。',
    ].join('\n');
}

/** 让某个 AI 回一封匿名来信 */
export async function replyLetter(ai, letter, opts = {}) {
    const apiRef = nook.resolveApiRefFor(ai, opts.seatIndex || 0);
    if (!apiRef) return { ok: false, text: '', error: nook.describeMissingApi() };

    const history = renderThread(letter?.thread, { meLabel: '匿名来信', themLabel: '你的回信' });
    const res = await generate({
        apiRef,
        systemPrompt: buildLetterboxSystem(ai, opts),
        userTurn: history || `匿名来信:\n${letter?.text || ''}`,
        temperature: 0.95,
        signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: res.error || '没有收到回信' };

    const text = cleanLine(res.text, { disableEmoji: opts.disableEmoji, max: 260, names: [ai?.name] });
    return text ? { ok: true, text, error: '' } : { ok: false, text: '', error: 'AI 返回了空内容' };
}

// ============================================================
// 漂流瓶
// ============================================================

function buildBottleSystem(ai, { custom, disableEmoji }) {
    return [
        personaBlock(ai),
        worldBlock(),
        extraBlock(custom),
        '',
        '场景:你往海里扔了一个漂流瓶。',
        '捡到它的人是谁、什么时候捡到,你都不会知道;你也永远等不到回音。',
        '正因为如此,你会写一些平时绝不会说出口的东西。',
        '',
        '要求:',
        '- 两到四句话,120 字以内。',
        '- 不要写「致某某」这样的抬头,也不要落款。',
        '- 不要提到能指认你身份的具体人名、地名或事件。',
        ...commonRules(disableEmoji).map((r) => `- ${r}`),
        '- 直接输出瓶子里那张纸上的内容。',
    ].join('\n');
}

/** 让一个 AI 写一个漂流瓶 */
export async function writeBottle(ai, seatIndex = 0, opts = {}) {
    const apiRef = nook.resolveApiRefFor(ai, seatIndex);
    if (!apiRef) return { ok: false, text: '', error: nook.describeMissingApi() };

    const res = await generate({
        apiRef,
        systemPrompt: buildBottleSystem(ai, opts),
        userTurn: opts.avoid
            ? `（重写一个。不要再写和这段意思相近的:「${truncate(opts.avoid, 60)}」）`
            : '（请写下你要放进瓶子里的话）',
        temperature: 1,
        signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: res.error || '这一位没有回应' };

    const text = cleanLine(res.text, { disableEmoji: opts.disableEmoji, max: 260, names: [ai?.name] });
    return text ? { ok: true, text, error: '' } : { ok: false, text: '', error: 'AI 返回了空内容' };
}

/**
 * 捡到瓶子的那个人读完之后写点什么。
 *
 * @param {object} reader 捡到瓶子的 AI(用户捡到的那组不走这里,由 UI 让用户自己写)
 * @param {string} bottleText 瓶子里的内容
 */
export async function readBottle(reader, bottleText, opts = {}) {
    const apiRef = nook.resolveApiRefFor(reader, opts.seatIndex || 0);
    if (!apiRef) return { ok: false, text: '', error: nook.describeMissingApi() };

    const system = [
        personaBlock(reader),
        worldBlock(),
        extraBlock(opts.custom),
        '',
        '场景:你在岸边捡到了一个漂流瓶,拆开看完了里面的字。',
        '你不知道是谁写的,也没有办法回信 —— 你只是站在那里,想了一会儿。',
        '',
        '要求:',
        '- 说说你读完的反应。可以共鸣、可以刻薄、可以走神想到别的事。',
        '- 两到四句话,120 字以内。',
        '- 不要猜写信人的具体身份。',
        ...commonRules(opts.disableEmoji).map((r) => `- ${r}`),
        '- 直接输出。',
    ].join('\n');

    const history = asArray(opts.thread).length
        ? renderThread(opts.thread, { meLabel: '瓶子里的话', themLabel: '你' })
        : `瓶子里的话:\n${bottleText || ''}`;

    const res = await generate({
        apiRef,
        systemPrompt: system,
        userTurn: history,
        temperature: 0.95,
        signal: opts.signal,
    });
    if (!res.ok) return { ok: false, text: '', error: res.error || '没有回应' };

    const text = cleanLine(res.text, { disableEmoji: opts.disableEmoji, max: 260, names: [reader?.name] });
    return text ? { ok: true, text, error: '' } : { ok: false, text: '', error: 'AI 返回了空内容' };
}

/**
 * 配对：谁的瓶子漂到了谁手上。
 *
 * ★ 必须是**错位排列**(derangement):没有人捡到自己的瓶子。
 *   直接 `shuffle` 会有大约 1/n 的概率出现自环,而自环在这个玩法里
 *   不是「小概率瑕疵」,是「这一轮白玩了」。
 *
 *   做法是环形错位:洗牌之后按环取 `to = next(from)`。
 *   n 个人一定得到 n 个互不相同、且都不等于自己的目标。
 */
export function pairUp(keys, rng = Math.random) {
    const list = asArray(keys).filter(Boolean);
    if (list.length < 2) return [];
    const ring = shuffle(list, rng);
    return ring.map((from, index) => ({ from, to: ring[(index + 1) % ring.length] }));
}

// ============================================================
// 内部
// ============================================================

/** 把一段对话渲染成给模型看的历史。空数组返回 '' 而不是 '(空)' */
function renderThread(turns, { meLabel = '对方', themLabel = '你' } = {}) {
    const list = asArray(turns);
    if (!list.length) return '';
    return list
        .map((turn) => `${turn.role === 'me' ? meLabel : themLabel}:${String(turn.text || '').trim()}`)
        .join('\n');
}

export function makeTurn(role, text) {
    return { id: makeId('t'), role: role === 'me' ? 'me' : 'them', text: String(text || ''), at: Date.now() };
}
