/**
 * 湛蓝回忆 · 剧本文件格式
 *
 * ── 这个文件是干什么的 ────────────────────────────────────────────
 *
 * 让「预先写好的故事」能以**一个纯文本文件**的形态进出本 App:
 *
 *   把游戏流程 + 指导 prompt 交给外部 AI
 *      → AI 吐出一份 .txt
 *      → `parseScript()` 校验并解析
 *      → 落成一棵真的 `ggNodes` 树
 *      → 没有 API Key 也能一路点着玩完
 *
 * 反向也成立:`formatScript()` 把一局已经存在的剧情树写回同一份格式,
 * 于是「导出 → 手改 → 再导入」是闭环的。
 *
 * ── 为什么不是 JSON ───────────────────────────────────────────────
 *
 * 这份文件的作者是**人和模型**,不是程序。JSON 的成本全在作者那边:
 * 少一个逗号整份废掉,中文引号、换行、缩进都能把模型绊倒,而且人手改起来难受。
 * 行式纯文本可以「坏一行只丢一行」,还能给出行号 —— 这正是校验报告要的东西。
 *
 * ── 为什么沿用 [TEXT]/[NAME]/[SCENE]/[MOOD]/[OPTIONS] ──────────────
 *
 * 因为模型**已经在为这个 App 输出这套标签**(见 `prompt-builder.js` 的
 * `buildFormatPart`)。再发明一套等价的词汇只会让同一个模型在两种协议之间摇摆,
 * 而且解析器要维护两份宽容逻辑。这里只在既有词汇之外补了「分幕」需要的几个:
 *
 *   [NODE] 标签      开一幕,标签是这一幕在文件内的唯一名字
 *   [FROM] 父标签    可选,显式声明父幕(给「不在选项里的分支」用)
 *   [CHOICE] 文字    可选,配合 [FROM] 说明玩家做了什么才走到这一幕
 *   [GOTO] 标签      写在选项行末尾,指明这条选项通向哪一幕
 *   [ENDING] 标题    这一幕是结局
 *   [TITLE]/[GENRE]/[TIME]/[OPENING]/[CAST]  文件头的元信息
 *
 * ── 宽容到什么程度 ────────────────────────────────────────────────
 *
 * 闭合标签可省、空行随便、全角【】和半角 [] 都认、`:` 和 `:` 都认、
 * markdown 围栏会被剥掉、开头的「好的,以下是…」会被跳过。
 * 宽容逻辑复用 `story-engine.js` 里的那份(`normalizeTagBrackets` /
 * `stripCodeFences` / `parseSpeakerLine` / `parseMoodPair` / `normalizeOption`),
 * **没有在这里重写一遍正则** —— 重写就等于把「谁在说话」变成两份真相。
 *
 * ── 这个文件是纯的 ────────────────────────────────────────────────
 *
 * 不碰 DOM、不碰 store、不碰 IndexedDB,只有字符串进、结构体出。
 * 落盘和文件读写在 `script-io.js`,状态变更在 `store.js`。
 */

import { TAGS, MOODS, MOOD_IDS, GENRES, OPTION_MAX_CHARS } from '../constants.js';
import { asArray, truncate } from '../utils.js';
import {
    NAME_TAG_RE, parseSpeakerLine, parseMoodPair, normalizeOption,
    stripCodeFences, normalizeTagBrackets,
} from './story-engine.js';

// ============================================================
// 标签表
// ============================================================

/** 在 `TAGS`(既有输出协议)之外,剧本额外需要的几个 */
export const SCRIPT_TAGS = Object.freeze({
    title: 'TITLE',
    genre: 'GENRE',
    time: 'TIME',
    opening: 'OPENING',
    cast: 'CAST',
    node: 'NODE',
    from: 'FROM',
    choice: 'CHOICE',
    goto: 'GOTO',
    ending: 'ENDING',
});

const ALL_TAGS = Object.freeze([...Object.values(TAGS), ...Object.values(SCRIPT_TAGS)]);

/** 一整行就是一个标签(后面可以跟冒号和内容) */
const TAG_LINE_RE = /^\[(\/?)([A-Z_]+)\]\s*[:：]?\s*(.*)$/;

/** 选项行末尾的目标标签:`[GOTO]xxx[/GOTO]` 或 `-> xxx` */
const GOTO_TAG_RE = /\[GOTO\]\s*[:：]?\s*([^\s[\]]+)\s*(?:\[\/GOTO\])?\s*$/;
const GOTO_ARROW_RE = /(?:->|=>|→|⇒|⟶)\s*([^\s[\]]+)\s*$/;

/** 标签只能是这些字符 —— 带空格 / 中文的标签在 `[GOTO]` 那边没法可靠地切出来 */
const LABEL_OK_RE = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * 会打断 `[TEXT]` / `[OPTIONS]` 块的标签。
 *
 * ★ 故意**不含** SCENE 和 MOOD:模型经常把它们塞在 `[TEXT]` 中间
 *   (`parseStoryResponse` 也是这么兜的)。把它们算成打断的话,
 *   后面那几句台词会掉出正文块,表现是「导进去少了几句」。
 */
const BLOCK_BREAKERS = new Set([
    'NODE', 'TEXT', 'OPTIONS', 'TITLE', 'GENRE', 'TIME', 'OPENING', 'CAST', 'FROM', 'CHOICE', 'ENDING',
]);

/** 文件头元信息标签 —— 见到其中之一就说明「废话结束,正文开始」 */
const HEAD_TAGS = new Set(['TITLE', 'GENRE', 'TIME', 'OPENING', 'CAST', 'NODE']);

function moodLabel(id) {
    return MOODS.find((m) => m.id === id)?.label || '默认';
}

function genreOf(raw) {
    const value = String(raw || '').trim();
    if (!value) return { id: '', label: '' };
    const hit = GENRES.find((g) => g.id && (g.id === value || g.label === value || `${g.label}` === `${value}向`));
    return hit ? { id: hit.id, label: hit.label } : { id: '', label: value };
}

/** 去掉行尾多余的闭合标签(`[TITLE]标题[/TITLE]` 这种写法) */
function stripClose(rest, tag) {
    return String(rest || '').replace(new RegExp(`\\[/${tag}\\]\\s*$`), '').trim();
}

// ============================================================
// 解析
// ============================================================

/**
 * 解析一份剧本文件。
 *
 * @param {string} rawText
 * @param {object} [opts]
 * @param {string[]} [opts.castNames]  名册(用来判「这个说话人认不认识」),留空就只从文件自身推
 * @param {string}   [opts.playerName] 玩家角色名(它的台词会被标成 isPlayer)
 * @returns {{
 *   ok: boolean,
 *   meta: object,
 *   nodes: Array,
 *   startLabel: string,
 *   errors: Array<{line:number, code:string, message:string}>,
 *   warnings: Array<{line:number, code:string, message:string}>,
 *   stats: object,
 * }}
 */
export function parseScript(rawText, opts = {}) {
    const errors = [];
    const warnings = [];
    const fail = (line, code, message) => errors.push({ line, code, message });
    const warn = (line, code, message) => warnings.push({ line, code, message });

    const playerName = String(opts.playerName || '').trim();
    const knownNames = new Set(
        asArray(opts.castNames).map((n) => String(n || '').trim()).filter(Boolean),
    );

    let text = stripCodeFences(String(rawText ?? ''));
    text = normalizeTagBrackets(text, ALL_TAGS);
    const lines = text.split(/\r\n|\r|\n/);

    const meta = { title: '', genreId: '', genreLabel: '', worldTime: '', opening: '', cast: [] };
    const nodes = [];
    const byLabel = new Map();

    let cur = null;
    let mode = '';              // '' | 'text' | 'options'
    let started = false;        // 见过第一个结构标签没有
    let preambleWarned = false;

    const openNode = (label, lineNo) => {
        cur = {
            label,
            labelKey: label.toLowerCase(),
            line: lineNo,
            from: '',
            choiceText: '',
            scene: '',
            moodDecl: {},
            ending: null,
            rawLines: [],
            rawOptions: [],
            looseWarned: false,
        };
        nodes.push(cur);
        mode = '';
    };

    for (let i = 0; i < lines.length; i += 1) {
        const lineNo = i + 1;
        const line = lines[i].trim();
        const m = line ? line.match(TAG_LINE_RE) : null;
        const closing = m ? m[1] === '/' : false;
        const tag = m ? m[2].toUpperCase() : '';
        const rest = m ? m[3].trim() : '';

        if (m && closing) {
            // 闭合标签只用来收块,收完就没别的意义了
            if (tag === 'TEXT' || tag === 'OPTIONS') mode = '';
            continue;
        }
        if (m && HEAD_TAGS.has(tag)) started = true;
        if (m && BLOCK_BREAKERS.has(tag)) mode = '';

        if (m && !closing) {
            let handled = true;
            switch (tag) {
                case 'TITLE': meta.title = stripClose(rest, 'TITLE'); break;
                case 'GENRE': {
                    const g = genreOf(stripClose(rest, 'GENRE'));
                    meta.genreId = g.id;
                    meta.genreLabel = g.label;
                    break;
                }
                case 'TIME': meta.worldTime = stripClose(rest, 'TIME'); break;
                case 'OPENING': meta.opening = stripClose(rest, 'OPENING'); break;
                case 'CAST':
                    meta.cast = stripClose(rest, 'CAST')
                        .split(/[,,、/|]/)
                        .map((x) => x.trim())
                        .filter(Boolean);
                    for (const name of meta.cast) knownNames.add(name);
                    break;
                case 'NODE': {
                    const label = stripClose(rest, 'NODE').split(/[\s|｜]+/)[0] || '';
                    const safe = LABEL_OK_RE.test(label) ? label : '';
                    if (!safe) {
                        const auto = `node${nodes.length + 1}`;
                        warn(lineNo, 'bad-label', `[NODE] 后面得跟一个只有英文/数字/下划线的短标签,这里读到「${truncate(label || '(空)', 16)}」,已临时叫它「${auto}」`);
                        openNode(auto, lineNo);
                    } else {
                        openNode(safe, lineNo);
                    }
                    if (byLabel.has(cur.labelKey)) {
                        fail(lineNo, 'duplicate-label', `标签「${cur.label}」在第 ${byLabel.get(cur.labelKey).line} 行已经用过了,同一份剧本里标签不能重复`);
                    } else {
                        byLabel.set(cur.labelKey, cur);
                    }
                    break;
                }
                case 'FROM':
                    if (cur) cur.from = stripClose(rest, 'FROM').split(/[\s|｜]+/)[0] || '';
                    else warn(lineNo, 'orphan-tag', '[FROM] 出现在任何 [NODE] 之前,已忽略');
                    break;
                case 'CHOICE':
                    if (cur) cur.choiceText = stripClose(rest, 'CHOICE');
                    else warn(lineNo, 'orphan-tag', '[CHOICE] 出现在任何 [NODE] 之前,已忽略');
                    break;
                case 'SCENE':
                    if (cur) cur.scene = stripClose(rest, 'SCENE');
                    break;
                case 'MOOD': {
                    if (!cur) break;
                    for (const piece of stripClose(rest, 'MOOD').split(/[;;\n]/)) {
                        const pair = parseMoodPair(piece);
                        if (!pair) {
                            if (piece.trim()) warn(lineNo, 'bad-mood', `情绪只能是 ${MOODS.map((x) => x.label).join(' / ')},没认出「${truncate(piece, 12)}」`);
                            continue;
                        }
                        cur.moodDecl[pair.name] = pair.mood;
                    }
                    break;
                }
                case 'ENDING': {
                    if (!cur) { warn(lineNo, 'orphan-tag', '[ENDING] 出现在任何 [NODE] 之前,已忽略'); break; }
                    const body = stripClose(rest, 'ENDING');
                    const split = body.match(/^(.*?)\s*[|｜]\s*([A-Za-z_-]{1,16})$/);
                    cur.ending = {
                        title: (split ? split[1] : body).trim() || '结局',
                        kind: split ? split[2].toLowerCase() : 'main',
                    };
                    break;
                }
                case 'TEXT':
                    if (!cur) { warn(lineNo, 'orphan-tag', '[TEXT] 出现在任何 [NODE] 之前,已忽略'); break; }
                    mode = 'text';
                    // `[TEXT]台词[/TEXT]` 写在同一行的情况
                    if (stripClose(rest, 'TEXT')) cur.rawLines.push({ line: lineNo, text: stripClose(rest, 'TEXT') });
                    break;
                case 'OPTIONS':
                    if (!cur) { warn(lineNo, 'orphan-tag', '[OPTIONS] 出现在任何 [NODE] 之前,已忽略'); break; }
                    mode = 'options';
                    if (stripClose(rest, 'OPTIONS')) cur.rawOptions.push({ line: lineNo, text: stripClose(rest, 'OPTIONS') });
                    break;
                default:
                    // NAME 以及任何没见过的标签:整行交给正文处理(台词行就长这样)
                    handled = false;
                    break;
            }
            if (handled) continue;
        }

        if (!line) continue;

        if (!cur) {
            // 「好的,以下是您要的剧本:」这类开场白
            if (!started) {
                if (!preambleWarned) {
                    preambleWarned = true;
                    warn(lineNo, 'preamble', '文件开头有几行不是剧本内容(多半是 AI 的客套话),已跳过');
                }
                continue;
            }
            warn(lineNo, 'orphan-line', `这一行不属于任何 [NODE],已忽略:${truncate(line, 20)}`);
            continue;
        }

        if (mode === 'options') {
            cur.rawOptions.push({ line: lineNo, text: line });
            continue;
        }
        if (mode !== 'text' && !cur.looseWarned) {
            cur.looseWarned = true;
            warn(lineNo, 'loose-text', `「${cur.label}」这一幕的正文没有放在 [TEXT] 里,已按正文处理`);
        }
        cur.rawLines.push({ line: lineNo, text: line });
    }

    if (!nodes.length) {
        fail(0, 'empty', '没有读到任何 [NODE],这份文件不是剧本(或者标签被写坏了)');
        return {
            ok: false, meta, nodes: [], startLabel: '', errors, warnings,
            stats: { nodes: 0, options: 0, endings: 0, segments: 0 },
        };
    }

    // ── 名册 ──
    // 文件自己声明过的名字(带 [NAME] 标记的、写进 [MOOD] 的)一律算数,
    // 这样「导入前还没挑角色」时,`名字:台词` 这种宽松写法照样认得出来。
    for (const node of nodes) {
        for (const entry of node.rawLines) {
            const tagged = entry.text.match(NAME_TAG_RE);
            if (tagged) knownNames.add(tagged[1].trim());
        }
        for (const name of Object.keys(node.moodDecl)) knownNames.add(name);
    }
    if (playerName) knownNames.add(playerName);
    const roster = { names: knownNames, playerName };

    // ── 逐幕成形 ──
    for (const node of nodes) {
        node.segments = [];
        let lastMood = 'default';
        for (const entry of node.rawLines) {
            const parsed = parseSpeakerLine(entry.text, roster);
            if (!parsed) continue;
            const declared = parsed.speaker ? node.moodDecl[parsed.speaker] : '';
            const mood = declared || lastMood;
            if (declared) lastMood = declared;
            node.segments.push({
                speaker: parsed.speaker,
                text: parsed.text,
                mood: MOOD_IDS.includes(mood) ? mood : 'default',
                isPlayer: parsed.isPlayer,
            });
        }
        if (!node.segments.length) {
            warn(node.line, 'empty-node', `「${node.label}」这一幕一句台词都没有`);
        }

        node.options = [];
        const seenText = new Set();
        for (const entry of node.rawOptions) {
            let body = entry.text;
            let goto = '';
            const tagHit = body.match(GOTO_TAG_RE);
            const arrowHit = tagHit ? null : body.match(GOTO_ARROW_RE);
            if (tagHit) {
                goto = tagHit[1];
                body = body.slice(0, tagHit.index);
            } else if (arrowHit) {
                goto = arrowHit[1];
                body = body.slice(0, arrowHit.index);
            }
            const cleaned = truncate(normalizeOption(body), OPTION_MAX_CHARS);
            if (!cleaned) {
                if (entry.text.trim()) warn(entry.line, 'empty-option', '这一行选项只有跳转没有文字,已跳过');
                continue;
            }
            if (seenText.has(cleaned)) {
                warn(entry.line, 'duplicate-option', `「${node.label}」里有两条一模一样的选项「${cleaned}」,第二条永远走不到`);
                continue;
            }
            seenText.add(cleaned);
            node.options.push({ text: cleaned, goto, line: entry.line });
        }

        // 未知说话人:能玩,但不会有立绘和好感度
        for (const seg of node.segments) {
            if (!seg.speaker) continue;
            if (knownNames.has(seg.speaker)) continue;
            warn(node.line, 'unknown-speaker', `「${seg.speaker}」不在名册里,导入后不会有立绘和好感度`);
            knownNames.add(seg.speaker);   // 同一个名字只提醒一次
        }

        if (!node.options.length && !node.ending) {
            warn(node.line, 'dead-end', `「${node.label}」既没有 [OPTIONS] 也没有 [ENDING],玩家走到这儿就卡住了`);
        }
    }

    // ── 连线 ──
    const parentOf = new Map();     // labelKey -> { parentKey, choiceText, kind, line }
    for (const node of nodes) {
        for (const opt of node.options) {
            if (!opt.goto) continue;
            const key = opt.goto.toLowerCase();
            const target = byLabel.get(key);
            if (!target) {
                fail(opt.line, 'missing-goto', `选项「${opt.text}」要跳到「${opt.goto}」,但这份剧本里没有这个 [NODE]`);
                continue;
            }
            if (target.labelKey === node.labelKey) {
                fail(opt.line, 'self-goto', `选项「${opt.text}」跳回了它自己所在的「${node.label}」`);
                continue;
            }
            const exist = parentOf.get(key);
            if (exist) {
                fail(opt.line, 'multi-parent', `「${target.label}」已经被第 ${exist.line} 行的选项指向了。剧本是一棵树,一幕只能有一个来路 —— 把这条线单独写一幕`);
                continue;
            }
            parentOf.set(key, { parentKey: node.labelKey, choiceText: opt.text, kind: 'option', line: opt.line });
        }
    }
    // [FROM] 补线:只对「没有任何选项指向」的幕生效,算作玩家自己写的分支
    for (const node of nodes) {
        if (!node.from) continue;
        const parentKey = node.from.toLowerCase();
        const parent = byLabel.get(parentKey);
        if (!parent) {
            fail(node.line, 'missing-from', `[FROM] 写的父节点「${node.from}」不存在`);
            continue;
        }
        const exist = parentOf.get(node.labelKey);
        if (exist) {
            if (exist.parentKey !== parentKey) {
                warn(node.line, 'from-mismatch', `「${node.label}」的 [FROM] 写的是「${node.from}」,但真正指向它的是「${byLabel.get(exist.parentKey)?.label || exist.parentKey}」的选项,以选项为准`);
            }
            continue;
        }
        if (parentKey === node.labelKey) {
            fail(node.line, 'self-goto', `「${node.label}」的 [FROM] 指向了自己`);
            continue;
        }
        parentOf.set(node.labelKey, {
            parentKey,
            choiceText: node.choiceText || node.label,
            kind: 'custom',
            line: node.line,
        });
    }

    // ── 起点 / 环 / 可达 ──
    const roots = nodes.filter((n) => !parentOf.has(n.labelKey));
    let startLabel = '';
    if (!roots.length) {
        fail(nodes[0].line, 'no-start', '每一幕都有来路,找不到开场那一幕 —— 多半是最前面那一幕被某个 [GOTO] 指了回去');
    } else {
        startLabel = roots[0].label;
        for (const extra of roots.slice(1)) {
            warn(extra.line, 'unreachable', `「${extra.label}」没有任何选项指向它,导入时会连同它下面的分支一起跳过`);
        }
    }

    for (const node of nodes) {
        const seen = new Set([node.labelKey]);
        let cursor = parentOf.get(node.labelKey);
        while (cursor) {
            if (seen.has(cursor.parentKey)) {
                fail(cursor.line, 'cycle', `「${node.label}」绕回了自己 —— 剧本里出现了闭环,玩家会在这几幕里打转`);
                break;
            }
            seen.add(cursor.parentKey);
            cursor = parentOf.get(cursor.parentKey);
        }
    }

    // 从起点走一遍,标出 depth / childLabels / 可达性
    const reachable = new Set();
    if (startLabel) {
        const startKey = startLabel.toLowerCase();
        const queue = [{ key: startKey, depth: 0 }];
        reachable.add(startKey);
        const childrenOf = new Map();
        for (const [key, edge] of parentOf.entries()) {
            if (!childrenOf.has(edge.parentKey)) childrenOf.set(edge.parentKey, []);
            childrenOf.get(edge.parentKey).push(key);
        }
        while (queue.length) {
            const { key, depth } = queue.shift();
            const node = byLabel.get(key);
            if (!node) continue;
            node.depth = depth;
            // 子节点按「选项顺序 → 补线」排,和舞台上看到的顺序一致
            const kids = asArray(childrenOf.get(key));
            const ordered = [
                ...node.options.map((o) => o.goto && o.goto.toLowerCase()).filter((k) => k && kids.includes(k)),
                ...kids.filter((k) => !node.options.some((o) => o.goto && o.goto.toLowerCase() === k)),
            ];
            node.childLabels = ordered.map((k) => byLabel.get(k)?.label || k);
            for (const kid of ordered) {
                if (reachable.has(kid)) continue;
                reachable.add(kid);
                queue.push({ key: kid, depth: depth + 1 });
            }
        }
    }
    for (const node of nodes) {
        if (reachable.has(node.labelKey)) continue;
        node.depth = 0;
        node.childLabels = node.childLabels || [];
        if (roots.includes(node)) continue;   // 上面已经单独提醒过了
        warn(node.line, 'unreachable', `「${node.label}」从开场走不到,导入时会被跳过`);
    }

    // ── 出口 ──
    const endings = nodes.filter((n) => n.ending).length;
    const openOptions = nodes.reduce((sum, n) => sum + n.options.filter((o) => !o.goto).length, 0);
    if (!endings && !openOptions) {
        fail(0, 'no-ending', '这份剧本没有终点:既没有任何 [ENDING],也没有任何「留白的选项」(不写 [GOTO] 表示这条线还没写完)');
    } else if (!endings) {
        warn(0, 'no-ending', '整份剧本没有 [ENDING]。可以导入,但玩家走到底只会看到「剧本到这里就没有下文了」');
    }

    for (const node of nodes) {
        node.parentLabel = parentOf.has(node.labelKey)
            ? (byLabel.get(parentOf.get(node.labelKey).parentKey)?.label || '')
            : '';
        const edge = parentOf.get(node.labelKey);
        node.choice = {
            kind: edge ? edge.kind : 'start',
            text: edge ? edge.choiceText : '',
        };
        node.reachable = reachable.has(node.labelKey);
        delete node.rawLines;
        delete node.rawOptions;
        delete node.looseWarned;
    }

    return {
        ok: errors.length === 0,
        meta,
        nodes,
        startLabel,
        errors,
        warnings,
        stats: {
            nodes: nodes.length,
            reachable: reachable.size,
            options: nodes.reduce((sum, n) => sum + n.options.length, 0),
            endings,
            segments: nodes.reduce((sum, n) => sum + n.segments.length, 0),
        },
    };
}

// ============================================================
// 导出
// ============================================================

/**
 * 把一局的剧情树写回剧本文件。
 *
 * 标签是**按遍历顺序现编**的(`start` / `n2` / `n3`…),不依赖任何存盘字段 ——
 * 所以同一棵树导出两次结果完全一样,`parseScript(formatScript(x))` 也就稳定。
 *
 * @param {object} arg
 * @param {object} arg.game
 * @param {Array}  arg.nodes      这一局的全部节点
 * @param {string[]} [arg.castNames] 写进 [CAST] 的名字
 * @param {Array}  [arg.scenes]   `library.scenes`,用来把 sceneKey 翻成场景名
 */
export function formatScript({ game, nodes, castNames, scenes } = {}) {
    const list = asArray(nodes);
    const byId = new Map(list.map((n) => [String(n.id), n]));
    const sceneName = new Map(asArray(scenes).map((s) => [String(s.id), String(s.name || '').trim()]));

    const rootId = byId.has(String(game?.rootNodeId || ''))
        ? String(game.rootNodeId)
        : String(list.find((n) => !n.parentId || !byId.has(String(n.parentId)))?.id || '');

    const out = [];
    const push = (line) => out.push(line);

    const genre = GENRES.find((g) => g.id && g.id === String(game?.genre || ''));
    if (game?.title) push(`[TITLE]${String(game.title).trim()}[/TITLE]`);
    if (genre) push(`[GENRE]${genre.label}[/GENRE]`);
    if (game?.worldTimeText) push(`[TIME]${String(game.worldTimeText).trim()}[/TIME]`);
    if (game?.openingHint) push(`[OPENING]${String(game.openingHint).trim()}[/OPENING]`);
    const cast = asArray(castNames).map((n) => String(n || '').trim()).filter(Boolean);
    if (cast.length) push(`[CAST]${cast.join(', ')}[/CAST]`);

    if (!rootId) {
        push('');
        return out.join('\n');
    }

    // 广度优先:先给每一幕分标签,再逐幕写正文
    const labelOf = new Map([[rootId, 'start']]);
    const order = [rootId];
    for (let i = 0; i < order.length; i += 1) {
        const node = byId.get(order[i]);
        for (const childId of asArray(node?.childIds)) {
            const key = String(childId);
            if (!byId.has(key) || labelOf.has(key)) continue;
            labelOf.set(key, `n${order.length + 1}`);
            order.push(key);
        }
    }

    for (const id of order) {
        const node = byId.get(id);
        if (!node) continue;
        const parent = node.parentId ? byId.get(String(node.parentId)) : null;

        push('');
        push(`[NODE]${labelOf.get(id)}`);

        // 选项里能表达的分支不用写 [FROM];玩家自己写的走向才需要
        const viaOption = parent && asArray(parent.options).includes(String(node.choice?.text || ''));
        if (parent && !viaOption) {
            push(`[FROM]${labelOf.get(String(parent.id))}`);
            if (node.choice?.text) push(`[CHOICE]${node.choice.text}`);
        }

        const scene = sceneName.get(String(node.sceneKey || '')) || '';
        const parentScene = parent ? (sceneName.get(String(parent.sceneKey || '')) || '') : '';
        if (scene && scene !== parentScene) push(`[SCENE]${scene}[/SCENE]`);

        const segments = asArray(node.segments);
        if (segments.length) {
            push(`[${TAGS.text}]`);
            for (const seg of segments) {
                const text = String(seg.text || '').replace(/\r?\n/g, ' ').trim();
                if (!text) continue;
                push(seg.speaker ? `[${TAGS.name}]${seg.speaker}[/${TAGS.name}]${text}` : text);
            }
            push(`[/${TAGS.text}]`);
        }

        // 情绪:按「一幕里一个角色一种表情」的既有协议还原
        let lastMood = 'default';
        const declared = new Map();
        for (const seg of segments) {
            const mood = MOOD_IDS.includes(seg.mood) ? seg.mood : 'default';
            if (!seg.speaker) { lastMood = mood; continue; }
            if (mood !== lastMood && !declared.has(seg.speaker)) declared.set(seg.speaker, mood);
            lastMood = mood;
        }
        for (const [speaker, mood] of declared.entries()) {
            push(`[${TAGS.mood}]${speaker}:${moodLabel(mood)}[/${TAGS.mood}]`);
        }

        const options = asArray(node.options);
        if (options.length) {
            push(`[${TAGS.options}]`);
            for (const text of options) {
                const child = asArray(node.childIds)
                    .map((cid) => byId.get(String(cid)))
                    .find((c) => c && String(c.choice?.text || '') === String(text));
                const goto = child ? labelOf.get(String(child.id)) : '';
                push(goto ? `${text} [${SCRIPT_TAGS.goto}]${goto}[/${SCRIPT_TAGS.goto}]` : String(text));
            }
            push(`[/${TAGS.options}]`);
        }

        if (node.ending) {
            const kind = String(node.ending.kind || 'main');
            const title = String(node.ending.title || '结局').trim() || '结局';
            push(`[${SCRIPT_TAGS.ending}]${kind && kind !== 'main' ? `${title}|${kind}` : title}[/${SCRIPT_TAGS.ending}]`);
        }
    }

    push('');
    return out.join('\n');
}

// ============================================================
// 格式说明 / 示例
// ============================================================

/**
 * 人读的格式说明。
 *
 * ★ 这一份同时被三个地方用:面板里的「格式说明」、给外部 AI 的指导 prompt、
 *   以及用户文档。只有一份,所以不会出现「文档说可以省,解析器不认」。
 */
export const SCRIPT_FORMAT_DOC = `湛蓝回忆 · 剧本文件格式

一份剧本 = 文件头(可选)+ 若干幕。一幕就是玩家在屏幕上看到的一屏对话 + 一组选项。

【文件头】写在第一个 [NODE] 之前,每项一行,都可以不写:
  [TITLE]故事标题[/TITLE]
  [GENRE]恋爱向[/GENRE]          恋爱向 / 冒险向 / 悬疑向 / 奇幻向 / 科幻向 / 日常向 / 治愈向 / 惊悚向
  [TIME]现代 · 七月的黄昏[/TIME]  故事发生在什么时候
  [OPENING]一句话交代开场[/OPENING]
  [CAST]夏海遥, 白临[/CAST]       会出场的角色名

【一幕】
  [NODE]标签                     必写。标签是这一幕在文件里的名字,只能用英文字母/数字/下划线,全文不重复
  [SCENE]海边台阶[/SCENE]         可选。换地方了才写,不写就沿用上一幕的场景
  [TEXT]                         正文开始
  旁白直接写一行
  [NAME]夏海遥[/NAME]"这是台词。"  角色台词:名牌 + 内容,引号写不写都行
  [/TEXT]                        正文结束
  [MOOD]夏海遥:开心[/MOOD]        可选。默认 / 开心 / 愤怒 / 伤心 / 惊讶 / 害羞 / 疑惑;一幕里一个角色只有一种表情
  [OPTIONS]                      选项开始
  在她旁边坐下 [GOTO]sit[/GOTO]   一行一条,末尾用 [GOTO] 指明通向哪一幕(写成 -> sit 也认)
  [/OPTIONS]                     选项结束
  [ENDING]第七个夏天[/ENDING]      可选。这一幕是结局;有结局就不用再写 [OPTIONS]

【接线规则】
  · 第一个没有被任何 [GOTO] 指向的 [NODE] 就是开场。
  · 一幕只能有一个来路 —— 两条选项不能指向同一幕(那是流程图,不是树)。想让两条线汇合,就各写一幕。
  · 选项不写 [GOTO] 也合法,意思是「这条线还没写」。玩到那儿会提示剧本到此为止。
  · 少数「不在选项里的走向」可以用 [FROM]父标签 + [CHOICE]玩家做了什么 单独挂一幕。
  · 整份剧本至少要有一个 [ENDING],或者至少留一条没写 [GOTO] 的选项,否则拒绝导入。

【宽容的地方】(不用刻意迁就,写错了也能进)
  · 【】和 [] 都认,: 和 : 都认,闭合标签(如 [/TEXT])可以不写
  · 空行随便加,markdown 围栏会被自动剥掉,开头的「好的,以下是…」会被跳过
  · 选项前面的「1. 」「- 」「A) 」会被自动去掉

【会被拦下的错】(导入前就报出来,带行号)
  标签重复 / [GOTO] 指向不存在的标签 / 一幕被指向两次 / 出现闭环 / 找不到开场 / 没有任何终点`;

/** 一份**完整可用**的最小剧本:5 幕、两层分支、3 个结局。 */
export const SCRIPT_EXAMPLE = `[TITLE]海边的第七个夏天[/TITLE]
[GENRE]恋爱向[/GENRE]
[TIME]现代 · 七月的黄昏[/TIME]
[OPENING]从我在海边台阶上遇见她开始[/OPENING]
[CAST]夏海遥[/CAST]

[NODE]start
[SCENE]海边台阶[/SCENE]
[TEXT]
海风把整条堤岸吹得发白,远处的灯塔刚刚亮起来。
[NAME]夏海遥[/NAME]"你也是来看海的吗?"
她把画板往身侧挪了挪,给我让出半个台阶。
[/TEXT]
[MOOD]夏海遥:开心[/MOOD]
[OPTIONS]
在她旁边坐下 [GOTO]sit[/GOTO]
说自己只是路过 [GOTO]leave[/GOTO]
[/OPTIONS]

[NODE]sit
[TEXT]
我在那半个台阶上坐下,木板还留着她的体温。
[NAME]夏海遥[/NAME]"这个位置的光,一天只有二十分钟。"
[/TEXT]
[OPTIONS]
问她画了多久 [GOTO]ask[/GOTO]
安静地陪她画完 [GOTO]stay[/GOTO]
[/OPTIONS]

[NODE]ask
[TEXT]
[NAME]夏海遥[/NAME]"第七年了。"
她说得很轻,笔尖没有停。
海面上的光正一寸一寸退回去。
[/TEXT]
[MOOD]夏海遥:伤心[/MOOD]
[ENDING]第七个夏天[/ENDING]

[NODE]stay
[TEXT]
我们谁都没说话,直到那片光从画纸上完全退走。
[NAME]夏海遥[/NAME]"明天这个时候,我还在这儿。"
[/TEXT]
[MOOD]夏海遥:害羞[/MOOD]
[ENDING]二十分钟的光[/ENDING]

[NODE]leave
[SCENE]堤岸尽头[/SCENE]
[TEXT]
我摆了摆手,顺着堤岸一直走到了尽头。
回头的时候,台阶上已经没有人了。
[/TEXT]
[ENDING]擦肩[/ENDING]
`;

export default { parseScript, formatScript, SCRIPT_FORMAT_DOC, SCRIPT_EXAMPLE, SCRIPT_TAGS };
