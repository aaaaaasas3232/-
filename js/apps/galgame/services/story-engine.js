/**
 * 湛蓝回忆 · 剧情解析
 *
 * 把 AI 那一坨文本变成 `{ segments, scene, moods, options }`。
 *
 * ── 相对原型修掉的三处 ────────────────────────────────────────────
 *
 * **① 角色名靠正则猜,猜错了整句丢掉。**
 * 原型的匹配表里有一条 `/^([^：:]+)[：:]/` —— 任何带冒号的句子都会被当成
 * 「角色名: 台词」。旁白写「时间：下午三点，海风很凉」就变成了一个叫「时间」的角色
 * 在说「下午三点，海风很凉」。这里改成**名册校验**:只有名字确实在出场角色里
 * (或者用了显式的 `[NAME]` 标签)才认,否则当旁白 —— 猜错的代价从「凭空多个角色」
 * 降到「少一个名牌」。
 *
 * **② 过滤主角台词用的是 `nameInTag.includes('我')`。**
 * 于是任何名字里带「我」的角色(「我妻由乃」)一开口整句就被 `return` 掉,
 * 玩家看到的是剧情莫名其妙断了一句。这里改成**精确匹配玩家名**,
 * 而且不删内容 —— 标成 `player` 段照常显示,只是名牌用另一种颜色。
 * AI 偶尔替玩家说一句话不是灾难,把内容吞掉才是。
 *
 * **③ 选项和剧情是两次调用出来的。**
 * 第二次调用只喂了「剥掉角色名的纯文本」,所以选项经常和剧情对不上
 * (谁说的都不知道了)。现在一次输出,选项是模型看着自己刚写的东西给的。
 */

import { TAGS, MOOD_ALIAS, MOOD_IDS, OPTION_MAX_CHARS } from '../constants.js';
import { asArray, truncate } from '../utils.js';

// ============================================================
// 标签工具
// ============================================================

function blockRe(tag) {
    return new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
}
function blockReAll(tag) {
    return new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'gi');
}

export function readBlock(raw, tag) {
    const m = String(raw || '').match(blockRe(tag));
    return m ? m[1].trim() : '';
}

export function readBlocks(raw, tag) {
    const out = [];
    const re = blockReAll(tag);
    let m;
    while ((m = re.exec(String(raw || '')))) out.push(m[1].trim());
    return out;
}

// ============================================================
// 宽容化 —— 只给「离线文本」用,live 路径不走这里
// ============================================================

/**
 * 剥掉 markdown 围栏。
 *
 * 模型很爱把整份文件包进 ``` 里,尤其是被要求「输出一个文件」的时候。
 * 整段被包住就取里面的内容;零散的围栏行直接删掉那一行 ——
 * **不能连带删掉内容**,否则用户看到的是「导入之后少了一大段」。
 */
export function stripCodeFences(raw) {
    const text = String(raw || '');
    const whole = text.trim().match(/^```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
    if (whole) return whole[1];
    return text.replace(/^[ \t]*```[a-zA-Z]*[ \t]*$/gm, '');
}

/**
 * 把全角 / 异体括号里的**已知标签**归一成半角大写。
 *
 * ★ 只认传进来的那几个标签名 —— 不能无差别地把 `【】` 全换掉,
 *   因为 `【夏海遥】"台词"` 是模型写角色名的常见写法(`LOOSE_NAME_PATTERNS` 里就有一条),
 *   全换的话角色名会被当成标签,整句变成解析不出来的垃圾。
 *
 * @param {string} raw
 * @param {string[]} tagNames 允许被归一的标签名(默认就是本 App 的输出协议)
 */
export function normalizeTagBrackets(raw, tagNames = Object.values(TAGS)) {
    const names = asArray(tagNames)
        .map((t) => String(t || '').trim())
        .filter((t) => /^[A-Za-z_]+$/.test(t));
    if (!names.length) return String(raw || '');
    const re = new RegExp(`[[【［〔]\\s*(/?)\\s*(${names.join('|')})\\s*[\\]】］〕]`, 'gi');
    return String(raw || '').replace(re, (_m, slash, name) => `[${slash}${name.toUpperCase()}]`);
}

/** 把所有已知标签从一段文本里剔干净(兜底路径用) */
function stripAllTags(raw) {
    let text = String(raw || '');
    for (const tag of Object.values(TAGS)) {
        text = text.replace(new RegExp(`\\[\\/?${tag}\\]`, 'gi'), '');
    }
    return text.trim();
}

// ============================================================
// 台词行解析
// ============================================================

export const NAME_TAG_RE = /\[NAME\]\s*(.+?)\s*\[\/NAME\]/i;

/** 显式标记之外,模型爱用的几种写法 —— 但都要过名册校验才认 */
const LOOSE_NAME_PATTERNS = [
    /^\*\*\s*(.+?)\s*\*\*\s*[:：]?/,
    /^【\s*(.+?)\s*】\s*[:：]?/,
    /^〔\s*(.+?)\s*〕\s*[:：]?/,
    /^([^\s"'“”「」『』:：]{1,12})\s*[:：]/,
];

/**
 * 解析一行。
 *
 * ★ 导出出去给剧本导入复用(`services/script-format.js`)——
 *   「谁在说话」的判据只该有一份实现,剧本文件里再写一遍正则就是第二份真相。
 *
 * @param {string} line
 * @param {{ names:Set<string>, playerName:string }} roster
 * @returns {{ speaker:string, text:string, isPlayer:boolean }|null}
 */
export function parseSpeakerLine(line, roster) {
    const raw = String(line || '').trim();
    if (!raw) return null;

    // ① 显式 [NAME] —— 无条件认(这是我们要求的格式)
    const tagged = raw.match(NAME_TAG_RE);
    if (tagged) {
        const speaker = tagged[1].trim();
        const text = raw.replace(NAME_TAG_RE, '').trim();
        if (!text) return null;   // 只有名牌没内容,丢掉
        return finish(speaker, text, roster);
    }

    // ② 宽松写法 —— 必须名字在册
    for (const pattern of LOOSE_NAME_PATTERNS) {
        const m = raw.match(pattern);
        if (!m) continue;
        const candidate = m[1].trim();
        if (!roster.names.has(candidate)) continue;
        const text = raw.slice(m[0].length).trim();
        if (!text) continue;
        return finish(candidate, text, roster);
    }

    // ③ 旁白
    return { speaker: '', text: raw, isPlayer: false };
}

function finish(speaker, text, roster) {
    const isPlayer = Boolean(roster.playerName) && speaker === roster.playerName;
    return { speaker, text, isPlayer };
}

// ============================================================
// 选项
// ============================================================

/** 去掉「1. 」「- 」「A) 」这类前缀和多余引号 */
export function normalizeOption(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';
    text = text.replace(/^[\s>*·•\-–—]+/, '');
    text = text.replace(/^[（(]?\s*(?:[0-9]{1,2}|[A-Da-d]|[一二三四五六七八九十])\s*[.、)）:：]\s*/, '');
    text = text.replace(/^["'“”「『]+|["'“”」』]+$/g, '');
    return text.trim();
}

function parseOptions(raw, limit) {
    const block = readBlock(raw, TAGS.options);
    if (!block) return [];
    return block
        .split('\n')
        .map(normalizeOption)
        .filter((x) => x && x.length <= OPTION_MAX_CHARS * 2)
        .map((x) => truncate(x, OPTION_MAX_CHARS))
        .slice(0, Math.max(2, limit || 3));
}

// ============================================================
// 情绪 / 场景
// ============================================================

/**
 * 解析一条「角色: 情绪」。
 *
 * 单独抽出来是给剧本导入复用的 —— 中文情绪名的归一表只该有一份。
 *
 * @returns {{ name:string, mood:string }|null}
 */
export function parseMoodPair(line) {
    const m = String(line || '').match(/^\s*(.+?)\s*[:：]\s*(.+?)\s*$/);
    if (!m) return null;
    const name = m[1].trim();
    const moodRaw = m[2].trim();
    const mood = MOOD_IDS.includes(moodRaw) ? moodRaw : MOOD_ALIAS[moodRaw];
    if (!name || !mood) return null;
    return { name, mood };
}

function parseMoods(raw) {
    const out = {};
    for (const line of readBlocks(raw, TAGS.mood)) {
        for (const one of line.split('\n')) {
            const pair = parseMoodPair(one);
            if (pair) out[pair.name] = pair.mood;
        }
    }
    return out;
}

// ============================================================
// 主解析
// ============================================================

/**
 * 解析一次完整回复。
 *
 * @param {string} raw
 * @param {object} ctx
 * @param {string[]} ctx.castNames
 * @param {string}   ctx.playerName
 * @param {number}   ctx.optionCount
 * @returns {{ segments:Array, scene:string, options:string[], warnings:string[] }}
 */
export function parseStoryResponse(raw, ctx = {}) {
    const warnings = [];
    const roster = {
        names: new Set([...asArray(ctx.castNames), ctx.playerName].filter(Boolean).map(String)),
        playerName: String(ctx.playerName || ''),
    };

    // 正文:优先取 [TEXT] 块;没有就取「[OPTIONS] 之前的一切」
    let body = readBlock(raw, TAGS.text);
    if (!body) {
        const src = String(raw || '');
        const cut = src.search(new RegExp(`\\[${TAGS.options}\\]`, 'i'));
        body = stripAllTags(cut > 0 ? src.slice(0, cut) : src);
        if (body) warnings.push('AI 没有用 [TEXT] 标签,已按整段正文处理');
    }
    // [SCENE] / [MOOD] 有可能被模型塞进 [TEXT] 里,先摘出来再逐行解析
    const scene = readBlock(body, TAGS.scene) || readBlock(raw, TAGS.scene);
    const moods = { ...parseMoods(raw), ...parseMoods(body) };
    body = body
        .replace(blockReAll(TAGS.scene), '')
        .replace(blockReAll(TAGS.mood), '')
        .replace(blockReAll(TAGS.options), '');

    const segments = [];
    let lastMood = 'default';
    for (const line of body.split('\n')) {
        const parsed = parseSpeakerLine(line, roster);
        if (!parsed) continue;
        // 情绪跟着说话人走;没标就沿用上一次(避免每句都跳回默认表情)
        const mood = parsed.speaker && moods[parsed.speaker] ? moods[parsed.speaker] : (parsed.speaker ? lastMood : lastMood);
        if (parsed.speaker && moods[parsed.speaker]) lastMood = moods[parsed.speaker];
        segments.push({
            speaker: parsed.speaker,
            text: parsed.text,
            mood,
            isPlayer: parsed.isPlayer,
        });
    }

    if (!segments.length) warnings.push('这次没解析出任何剧情内容');

    const options = parseOptions(raw, ctx.optionCount);
    if (!options.length) warnings.push('AI 没给选项,已用兜底选项');

    return { segments, scene, moods, options, warnings };
}

// ============================================================
// 兜底选项
// ============================================================

/**
 * AI 没给选项时的兜底。
 *
 * ★ 原型的兜底是一句固定的「继续」,而且**兜底之后节点里存的 options 是空的** ——
 *   于是那个节点在「节点分析」里永远显示不出可选项,回溯到那儿就卡死。
 *   这里给三条真的能推进剧情的通用选项,并且照常存进节点。
 */
export function fallbackOptions(count = 3) {
    const pool = ['继续看下去', '主动开口说点什么', '先离开这里', '仔细观察四周'];
    return pool.slice(0, Math.max(2, Math.min(4, count)));
}

/** 节点摘要 —— 剧情树的节点标签、回顾列表的一行 */
export function summarizeNode(node, max = 18) {
    const spoken = asArray(node?.segments).find((s) => s.speaker && !s.isPlayer);
    const any = asArray(node?.segments)[0];
    const src = spoken || any;
    if (!src) return '(空)';
    return truncate(String(src.text || '').replace(/^["'“”「『]+|["'“”」』]+$/g, ''), max);
}
