/**
 * 情景聊天 · Prompt 组装(唯一真相)
 *
 * ── 用的是系统里已有的那一套 ──────────────────────────────────────
 *
 * `src/core/context-composer.js` —— murmur(chat-app)和梦境编织都在用的
 * 上下文拼装器。它把「拼装」做成纯函数,把「预览」做成它的一个消费者:
 *
 *   const { text, parts } = buildPrompt({ … });
 *   //      ↑ 发给 AI     ↑ 给用户看
 *
 * 两者是同一次调用的两个返回字段,**物理上不可能不一致**。
 * 这条约束存在的原因是 murmur 和梦境编织都各自踩过一次:
 * 一边「预览是渲染函数的副作用,不点进那一页就是旧的」,
 * 一边「预览走 A 函数、发送走 B 函数,用户在预览里关掉的段照样发出去」。
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐 `docs/跨App注册Prompt指导方案.md` §5.1(murmur / 梦境编织同款):
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条,**不铺陈背景**。
 * 上下文长度有限,多写一百行就等于把用户的剧情挤掉一百行。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import { CONTEXT_SECTIONS, MODES, LENGTHS } from '../constants.js';
import { asArray, kvBlock, truncate, clamp } from '../utils.js';
import * as nook from './nook-bridge.js';
import { describeTheater } from './app-bridges.js';
import { describeRulesForAi } from './regex-engine.js';

const composer = createContextComposer({ namespace: 'scene-play' });

export { composer };

function modeLabel(id) {
    return MODES.find((m) => m.id === id)?.label || '小剧场';
}

function lengthWords(id) {
    return LENGTHS.find((l) => l.value === id)?.words || '200~350';
}

// ============================================================
// 各段正文
// ============================================================

/**
 * 演出须知。
 *
 * ★ 这一段按体裁分叉。第一版是「一段通用须知 + 后面追加一句体裁说明」,
 *   结果日记体下 AI 还是会写成一问一答 —— 因为通用须知里那句
 *   「别替用户说话」在日记体里根本不适用,两条指令互相打架时模型随机挑一边。
 */
function buildSystemPart({ scene, settings }) {
    const words = lengthWords(settings?.length);
    const common = [
        `    - 一次写 ${words} 字左右,写到一个自然的停顿就停`,
        '    - 承接【近期内容】的语气、称呼和时间线,不要另起炉灶',
        '    - 世界观里没写的可以合理发挥,但不能和已写的冲突',
        '    - 不要解释你打算怎么写,直接写',
    ];

    if (scene?.mode === 'diary') {
        return `执笔须知:
  - Principle: 你在替这个情景里的角色写日记,写完这一篇就停。
  - Behaviors:
    - 用第一人称,写当天真正发生的事和当时的想法
    - **不要**写成对话,也不要出现「你说」「我问」这种一来一回
${common.join('\n')}`;
    }

    if (scene?.mode === 'blog') {
        return `执笔须知:
  - Principle: 你在替这个情景里的角色写一篇公开的贴文。
  - Behaviors:
    - 有一个能当标题的开头,正文是写给别人看的语气
    - 可以带一点情绪和态度,但别写成日记独白
${common.join('\n')}`;
    }

    return `演出须知:
  - Principle: 你负责演这个情景里除了「我」以外的所有角色,直接写下一段。
  - Behaviors:
    - **绝不替「我」说话、不替「我」做决定** —— 那是用户的部分
    - 人物言行必须符合【出场角色】里的设定,不要临时加设定
    - 一次可以有多个角色说话,但别让所有人轮流发一遍言
${common.join('\n')}`;
}

function buildWorldPart({ world, clips }) {
    const base = nook.describeWorld(world);
    const clipText = asArray(clips)
        .filter((c) => c.content.trim())
        .map((c) => `【${c.title}】${c.content.trim()}`)
        .join('\n');
    return [base, clipText].filter(Boolean).join('\n\n');
}

function buildUserPart({ userCard }) {
    const base = nook.describeUser(userCard);
    if (!base) return '';
    return `${base}\n\n注意: 以上是**用户本人**。他的言行由他自己写,你不要替他说话。`;
}

function buildCastPart({ cast }) {
    const list = asArray(cast);
    if (!list.length) return '';
    return list
        .map((c) => {
            const detail = nook.describeAi(c.ai);
            const note = c.note ? `本情景设定: ${c.note}` : '';
            return [`【${c.ai.name}】`, detail, note].filter(Boolean).join('\n');
        })
        .join('\n\n');
}

function buildScenePart({ scene, location }) {
    return kvBlock([
        ['标题', scene?.title],
        ['体裁', modeLabel(scene?.mode)],
        ['地点', location?.name],
        ['地点简介', location?.summary],
        ['时间', scene?.timeText],
        ['情景', scene?.setting],
        ['要往哪儿走', scene?.aim],
    ]);
}

function buildClipsPart({ clips }) {
    const list = asArray(clips).filter((c) => c.content.trim());
    if (!list.length) return '';
    return list.map((c) => `【${c.title}】${c.content.trim()}`).join('\n\n');
}

function buildTheaterPart({ theater }) {
    return theater ? describeTheater(theater) : '';
}

function buildNotesPart({ notes }) {
    const list = asArray(notes).filter((n) => n.active && n.content.trim());
    if (!list.length) return '';
    return list.map((n) => `【${n.title}】${n.content.trim()}`).join('\n\n');
}

/**
 * 近期内容。
 *
 * 只取最后 N 条,而且**从后往前取** —— 从前往后取的话,聊到第五十条时
 * 喂给 AI 的还是开场那几句,它会一直在往回演。
 */
function buildRecentPart({ messages, limit, userName }) {
    const list = asArray(messages).slice(-clamp(limit, 4, 80));
    if (!list.length) return '';
    return list
        .map((m) => {
            if (m.role === 'system') return `(旁白)${m.text}`;
            const who = m.role === 'user' ? (userName || '我') : (m.speaker || '');
            return who ? `${who}: ${m.text}` : m.text;
        })
        .join('\n');
}

/**
 * 输出格式。
 *
 * ★ 这一段是**用户启用的正则规则现拼出来的**,不是写死的常量。
 *   写死的话,用户新建一条正则之后 AI 永远不会写出那个格式,
 *   他会以为「我的正则没生效」—— 而实际上是根本没人告诉过 AI 有这个写法。
 */
function buildFormatPart({ rules, scene }) {
    const rulesText = describeRulesForAi(rules);
    const modeNote = scene?.mode === 'dialogue'
        ? '普通台词直接写,不需要任何标记 —— 它会自动排成气泡。'
        : '正文直接写,不需要任何标记。';
    return [modeNote, rulesText].filter(Boolean).join('\n\n');
}

// ============================================================
// 组装
// ============================================================

/**
 * 收集这次生成要用到的全部外部数据。
 *
 * 单独抽出来是因为**上下文面板和发送都要它** —— 各读各的就会出现
 * 「面板里显示了三个角色,实际只发出去两个」这种对不上的情况。
 */
export function collectSources({ scene, library, messages, theater }) {
    const userCard = nook.getUserCard(scene?.userPersonaId);
    const world = nook.getWorld(scene?.worldId, userCard);

    const cast = asArray(scene?.castIds)
        .map((id) => {
            const ai = nook.getAi(id);
            if (!ai) return null;
            return { ai, note: String(scene?.castNotes?.[id] || '') };
        })
        .filter(Boolean);

    const locations = nook.listWorldLocations(world);
    const location = locations.find((l) => String(l.id) === String(scene?.locationId)) || null;

    const clipIds = new Set(asArray(scene?.clipIds).map(String));
    const clips = asArray(library?.clips).filter((c) => clipIds.has(String(c.id)));

    const ruleIds = new Set(asArray(scene?.regexIds).map(String));
    const rules = asArray(library?.rules).filter((r) => r.enabled !== false && ruleIds.has(String(r.id)));

    return { userCard, world, worldClips: nook.listWorldClips(world), cast, location, clips, rules, messages, theater };
}

/**
 * 产出这次生成的全部上下文段落。
 *
 * **上下文面板和发送共用这一个函数** —— 整个 App 里最重要的一条约束。
 */
export function buildContextParts(ctx = {}) {
    const { scene, library, sources } = ctx;
    if (!scene || !library || !sources) return [];

    const settings = library.settings;
    const config = scene.contextConfig || {};

    const bodies = {
        system: buildSystemPart({ scene, settings }),
        world: buildWorldPart({ world: sources.world, clips: sources.worldClips }),
        user: buildUserPart({ userCard: sources.userCard }),
        cast: buildCastPart({ cast: sources.cast }),
        scene: buildScenePart({ scene, location: sources.location }),
        clips: buildClipsPart({ clips: sources.clips }),
        theater: buildTheaterPart({ theater: sources.theater }),
        notes: buildNotesPart({ notes: scene.notes }),
        recent: buildRecentPart({
            messages: sources.messages,
            limit: settings.historyLimit,
            userName: sources.userCard?.name,
        }),
        format: buildFormatPart({ rules: sources.rules, scene }),
    };

    return CONTEXT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        // locked 段不给关 —— 关掉「演出须知」和「输出格式」之后 AI 会开始写解说词,
        // 正则一条都认不出来,表现是「发出去没反应」
        active: meta.locked ? true : config[meta.id] !== false,
        locked: meta.locked === true,
        source: meta.desc,
    }));
}

/**
 * 拼出最终 system prompt。
 *
 * `opts.save` 控制要不要写快照:发送时写(留一份「上次发出去的是什么」),
 * 上下文面板预览时**不写** —— 预览是个 computed,每次重渲染都写一遍
 * localStorage 既浪费,又会把真正发出去的那份快照冲掉。
 *
 * 注意两条路径走的是**同一个函数**,只是要不要落快照的差别。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}, opts = {}) {
    const parts = buildContextParts(ctx);
    const composeOpts = {
        order: asArray(ctx.scene?.contextOrder).length ? ctx.scene.contextOrder : undefined,
    };
    if (opts.save === false) return composer.compose(parts, composeOpts);
    const scope = `${ctx.scene?.id || 'none'}::${ctx.saveId || 'default'}`;
    return composer.composeAndSave(scope, parts, composeOpts);
}

// ============================================================
// 本轮指令
// ============================================================

/**
 * 拼「这一轮要 AI 干什么」。
 *
 * 和 system prompt 分开:system 是设定(每轮基本不变,便于服务端缓存),
 * 这一段才是本轮指令。两者拼成一个巨大字符串塞进 system 既浪费缓存,
 * 也让模型分不清「设定」和「现在要我干嘛」。
 *
 * @param {object} p
 * @param {'open'|'reply'|'continue'|'reroll'} p.kind
 * @param {string} [p.userText]   用户这一轮写的
 * @param {string} [p.note]       重 roll 时的修改意见
 * @param {string} [p.userName]
 */
export function buildUserTurn({ kind, userText, note, userName }) {
    const who = userName || '我';

    if (kind === 'open') {
        return [
            '请写下这个情景的开头。',
            '交代清楚时间、地点、和谁在一起,然后停在一个自然的地方,等我接。',
        ].join('\n');
    }

    if (kind === 'continue') {
        return `${who}这一轮什么都没说。顺着刚才的势头往下写一段,不要凭空跳过时间,也不要替${who}做决定。`;
    }

    if (kind === 'reroll') {
        const hint = String(note || '').trim();
        return [
            '刚才那一段重写一次。',
            hint ? `这次要:${hint}` : '换一个方向,不要和刚才那版雷同。',
            '直接给新的那一段,不要说明改了什么。',
        ].join('\n');
    }

    return `${who}:${String(userText || '').trim()}\n\n接着往下写。`;
}

/** 读上一次拼好的快照(「上次发出去的是什么」) */
export function readLastPrompt(sceneId, saveId) {
    return composer.load(`${sceneId || 'none'}::${saveId || 'default'}`);
}

// ============================================================
// 附属调用
// ============================================================

/**
 * 给存档起名 / 生成摘要。
 *
 * 存档列表里如果只有「存档 1 / 存档 2」,攒到第八个就完全分不清了。
 */
export function buildDigestPrompt({ messages, userName }) {
    const body = asArray(messages).slice(-20).map((m) => {
        const who = m.role === 'user' ? (userName || '我') : (m.speaker || (m.role === 'system' ? '旁白' : '对方'));
        return `${who}: ${m.text}`;
    }).join('\n');

    return `起名须知:
  - Principle: 读下面这段内容,给它起一个短标题,再用一句话说清发生了什么,只输出 JSON。
  - Behaviors:
    - title 4~10 字,像章节名,不要书名号
    - summary 一句话,30 字以内,说事不抒情
    - 只输出 JSON,不要围栏、不要解释

内容:
${truncate(body, 2000)}

输出:
{"title":"...","summary":"..."}`;
}
