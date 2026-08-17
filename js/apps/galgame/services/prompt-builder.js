/**
 * 湛蓝回忆 · Prompt 组装(唯一真相)
 *
 * ── 这个文件修的是原型最要命的一处 ────────────────────────────────
 *
 * 原型有**三条**互不相干的 prompt 路径:
 *
 *   | 位置 | 谁在用 |
 *   |---|---|
 *   | `startGame()` 里现拼的 `enhancedSystemPrompt` | 生成剧情 —— 真正发出去的 |
 *   | `fetchOptions()` 里 `currentSystemPrompt.replace(/正则/s, '...')` | 生成选项 |
 *   | 「查看上下文」弹窗读的 `lastAiContext` | 给用户看的 |
 *
 * 第二条尤其脆:它靠正则去**改写第一条的正文**,而第一条是按世界观运行时拼的 ——
 * 世界观里随便多一句话都可能让正则失配。失配时会把「不要生成任何选项」原样发出去,
 * 然后紧接着要求它生成选项,自相矛盾,模型只能随机挑一边执行。
 * 这就是原型里「有时候给选项、有时候不给」的根因,而它**不报任何错**。
 *
 * ── 现在的做法 ────────────────────────────────────────────────────
 *
 * 只有一个 `buildContextParts()`。它产出一组 part;
 * 「上下文」面板渲染这组 part,发送时把**同一组** part 交给 `composeContext()`。
 *
 *   const { text, parts } = buildPrompt({ … });
 *   //      ↑ 发给 AI     ↑ 给用户看
 *
 * 两者是同一次调用的两个返回字段,**物理上不可能不一致**。
 * 段落开关 = `game.contextConfig[sectionId]`,唯一入口,面板里点一下立刻影响发送。
 *
 * ── 写 prompt 的风格 ──────────────────────────────────────────────
 *
 * 对齐 murmur / 梦境编织那套(`docs/跨App注册Prompt指导方案.md` §5.1):
 *
 *   XX须知:
 *     - Principle: 一句话说清这段干嘛的
 *     - Behaviors:
 *       - 具体动作
 *       - 边界条件
 *
 * Principle 一条,Behaviors 三到六条,**不铺陈背景**。
 */

import { createContextComposer } from '@/src/core/context-composer.js';
import {
    CONTEXT_SECTIONS, GENRES, MOODS, TAGS, OPTION_MAX_CHARS,
    SCRIPT_SECTIONS, SCRIPT_BUDGET,
} from '../constants.js';
import { kvBlock, asArray, clamp, truncate } from '../utils.js';
import * as nook from './nook-bridge.js';
import { readContext } from './kchain.js';
import { SCRIPT_FORMAT_DOC, SCRIPT_EXAMPLE } from './script-format.js';

const composer = createContextComposer({ namespace: 'galgame' });

export { composer };

function genreLabel(id) {
    return GENRES.find((g) => g.id === id)?.label || '';
}

// ============================================================
// 各段正文
// ============================================================

function buildSystemPart({ game, settings }) {
    const genre = genreLabel(game?.genre);
    return `编剧须知:
  - Principle: 你是这部${genre || '视觉小说'}的编剧兼演出,直接写下一幕,不要解释你打算怎么写。
  - Behaviors:
    - 一次只推进**一小段**:最多 ${clamp(settings?.maxSentences, 2, 10)} 句,写到「该玩家做选择了」就停
    - **绝不替玩家说话、不替玩家做决定**。玩家角色的台词和行动留给选项
    - 人物言行必须符合【角色】里的设定,不要临时给人物加设定
    - 承接【近期剧情】的语气、称呼和时间线,不要另起炉灶
    - 世界观里没写的东西可以合理发挥,但不能和已写的冲突
    - 每一幕都要给玩家留下**可以选**的余地,不要把路走死
    - 不写色情、裸露、性暗示;也不把人物写成可以拿去画角色卡的立绘(不写身材、服装特写、姿势特写)
    - 故事可以普通、可以难过、可以轻,但不要写成逃离现实的成人向`;
}

function buildWorldPart({ world, clips }) {
    const base = nook.describeWorld(world);
    const clipText = asArray(clips)
        .filter((c) => c.content.trim())
        .map((c) => `【${c.title}】${c.content.trim()}`)
        .join('\n');
    return [base, clipText].filter(Boolean).join('\n\n');
}

function buildPlayerPart({ game, playerCard }) {
    const base = nook.describePlayer(playerCard);
    const extra = kvBlock([
        ['故事时间', game?.worldTimeText],
        ['题材', genreLabel(game?.genre)],
    ]);
    const note = base || extra
        ? '\n\n注意: 以上是**玩家操作的角色**。不要生成他的台词,他的言行由玩家从选项里选。'
        : '';
    return [base, extra].filter(Boolean).join('\n') + note;
}

/**
 * 出场角色。
 *
 * 人设本体从 nook 现读(所以在 nook 里改了这边立刻生效);
 * 「本机备注」和 NPC 标记来自 `library.cast` —— 这些是 nook 里没有的东西。
 */
function buildCastPart({ cast }) {
    const list = asArray(cast).filter((c) => c.enabled);
    if (!list.length) return '';
    return list
        .map((c) => {
            const detail = nook.describeAi(c.ai);
            const note = c.note ? `本作设定: ${c.note}` : '';
            const role = c.isNpc ? '(配角/NPC)' : '(主要角色)';
            return [`【${c.ai.name}】${role}`, detail, note].filter(Boolean).join('\n');
        })
        .join('\n\n');
}

/**
 * 可用场景。
 *
 * 名字和简介优先从 nook 的场所现读,本机只补一张图 ——
 * 所以这段发给 AI 的内容里**不含图片 URL**(它对写故事没有帮助,只是白烧 token)。
 */
function buildScenesPart({ scenes }) {
    const list = asArray(scenes);
    if (!list.length) return '';
    const lines = list.map((s) => (s.description ? `- ${s.name}: ${s.description}` : `- ${s.name}`));
    return `可以发生在这些地方(切换场景时用 [${TAGS.scene}]场景名[/${TAGS.scene}] 标注):\n${lines.join('\n')}`;
}

function buildQuestPart({ quest }) {
    if (!quest?.title) return '';
    return kvBlock([
        ['主线', quest.title],
        ['目标', quest.description],
        ['状态', quest.completed ? '已完成' : '进行中'],
    ]) + (quest.completed ? '' : '\n\n注意: 剧情要朝这条主线推进,但不要每一幕都把它挂在嘴边。');
}

function buildAffectionPart({ affection, cast }) {
    const entries = asArray(cast)
        .filter((c) => c.enabled && c.trackAffection)
        .map((c) => {
            const a = affection?.[c.ai.id];
            if (!a) return '';
            const level = a.value >= 70 ? '亲近' : a.value >= 35 ? '普通' : '疏远';
            return `- ${c.ai.name}: ${a.value}/100(${level})${a.thoughts ? ` — 此刻在想「${a.thoughts}」` : ''}`;
        })
        .filter(Boolean);
    if (!entries.length) return '';
    return `角色对玩家的当前态度:\n${entries.join('\n')}\n\n注意: 语气亲疏要跟这个数值对得上,不要写成刚认识或者已经交往。`;
}

function buildNotesPart({ notes }) {
    const list = asArray(notes).filter((n) => n.active && n.content.trim());
    if (!list.length) return '';
    return list.map((n) => `【${n.title}】${n.content.trim()}`).join('\n\n');
}

function buildCustomPart({ customPrompts }) {
    const list = asArray(customPrompts).filter((p) => p.enabled && p.content.trim());
    if (!list.length) return '';
    return list.map((p) => (p.title ? `【${p.title}】\n${p.content.trim()}` : p.content.trim())).join('\n\n');
}

/**
 * 输出格式。
 *
 * ★ 原型分两次调用(先剧情、再选项),这里合成一次。
 *   一次调用的好处不只是快一半 —— 选项是**看着自己刚写的剧情**生成的,
 *   不会出现「选项和剧情对不上」(原型里选项那次只喂了剥掉角色名的纯文本)。
 */
function buildFormatPart({ settings }) {
    const count = clamp(settings?.optionCount, 2, 4);
    const moods = MOODS.map((m) => m.label).join(' / ');
    return `输出格式须知:
  - Principle: 严格按下面的标签输出,解析器只认这几个标签,多一个字都会被丢掉。
  - Behaviors:
    - 剧情放在 [${TAGS.text}] 和 [/${TAGS.text}] 之间,一行一句
    - 角色台词写成 [${TAGS.name}]角色名[/${TAGS.name}]"台词内容",旁白不加名字标记
    - 换了地方就加一行 [${TAGS.scene}]场景名[/${TAGS.scene}],没换就不写
    - 角色表情有明显变化时加 [${TAGS.mood}]角色名:情绪[/${TAGS.mood}],情绪只能是: ${moods}
    - 最后给 ${count} 个玩家选项,放在 [${TAGS.options}] 和 [/${TAGS.options}] 之间,一行一个,不要编号
    - 选项写成玩家**要说的话或要做的事**,每条 ${OPTION_MAX_CHARS} 字以内,几条之间方向要真的不一样

示例:
[${TAGS.text}]
[${TAGS.name}]夏海遥[/${TAGS.name}]"你也是来看海的吗?"
她把画板往身侧挪了挪,给我让出半个台阶。
[${TAGS.name}]夏海遥[/${TAGS.name}]"这个位置的光,一天只有二十分钟。"
[/${TAGS.text}]
[${TAGS.scene}]海边台阶[/${TAGS.scene}]
[${TAGS.mood}]夏海遥:开心[/${TAGS.mood}]
[${TAGS.options}]
在她旁边坐下
问她画的是什么
说自己只是路过
[/${TAGS.options}]`;
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
export function collectSources({ game, library, currentNode, nodeMap }) {
    const playerCard = nook.getPlayerCard(game?.userPersonaId);
    const world = nook.getWorld(game?.worldId, playerCard);

    const castConf = library?.cast || {};
    const cast = asArray(game?.castIds)
        .map((id) => {
            const ai = nook.getAi(id);
            if (!ai) return null;
            const conf = castConf[id] || {};
            return {
                ai,
                enabled: true,
                isNpc: conf.isNpc === true,
                trackAffection: conf.trackAffection !== false && conf.isNpc !== true,
                note: String(conf.note || ''),
                sprites: conf.sprites || {},
                defaultMood: conf.defaultMood || 'default',
            };
        })
        .filter(Boolean);

    // 场景:本机记录里挑出这局能用的,名字/简介优先从 nook 现读
    const locations = nook.listWorldLocations(world);
    const locMap = new Map(locations.map((l) => [l.id, l]));
    const scenes = asArray(library?.scenes).map((s) => {
        const loc = s.locationId ? locMap.get(s.locationId) : null;
        return {
            id: s.id,
            name: loc?.name || s.name,
            description: loc?.summary || s.description,
            imageUrl: s.imageUrl,
            locationId: s.locationId,
        };
    });

    const kctx = readContext(currentNode, nodeMap || new Map(), library?.settings?.kChain);

    return {
        playerCard,
        world,
        clips: nook.listWorldClips(world),
        cast,
        scenes,
        kctx,
    };
}

/**
 * 产出这次生成的全部上下文段落。
 *
 * **上下文面板和发送共用这一个函数** —— 整个重写里最重要的一条约束。
 */
export function buildContextParts(ctx = {}) {
    const { game, library, sources } = ctx;
    if (!game || !library || !sources) return [];

    const settings = library.settings;
    const config = game.contextConfig || {};

    const bodies = {
        system: buildSystemPart({ game, settings }),
        world: buildWorldPart({ world: sources.world, clips: sources.clips }),
        player: buildPlayerPart({ game, playerCard: sources.playerCard }),
        cast: buildCastPart({ cast: sources.cast }),
        scenes: buildScenesPart({ scenes: sources.scenes }),
        quest: buildQuestPart({ quest: game.quest }),
        affection: buildAffectionPart({ affection: game.affection, cast: sources.cast }),
        memory: sources.kctx.memory,
        notes: buildNotesPart({ notes: game.notes }),
        recent: sources.kctx.recent,
        custom: buildCustomPart({ customPrompts: game.customPrompts }),
        format: buildFormatPart({ settings }),
    };

    return CONTEXT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        // locked 段不给关 —— 关掉「编剧须知」和「输出格式」之后 AI 会开始写散文,
        // 解析器一条都认不出来,表现是「点了没反应」
        active: meta.locked ? true : config[meta.id] !== false,
        locked: meta.locked === true,
        source: meta.desc,
    }));
}

/**
 * 拼出最终 system prompt。
 *
 * `opts.save` 控制要不要写快照:发送时写(留一份「上次发出去的是什么」),
 * 上下文面板预览时**不写** —— 预览是个 computed,每次重渲染都写一遍 localStorage
 * 既浪费又会把真正发出去的那份快照冲掉。
 *
 * 注意两条路径走的是**同一个函数**,只是要不要落快照的差别 ——
 * 「预览 == 发送」这条约束没有被破坏。
 *
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildPrompt(ctx = {}, opts = {}) {
    const parts = buildContextParts(ctx);
    const composeOpts = {
        order: asArray(ctx.game?.contextOrder).length ? ctx.game.contextOrder : undefined,
    };
    if (opts.save === false) return composer.compose(parts, composeOpts);
    const scope = `${ctx.game?.id || 'none'}::${ctx.currentNode?.id || 'root'}`;
    return composer.composeAndSave(scope, parts, composeOpts);
}

// ============================================================
// 本轮指令
// ============================================================

/**
 * 拼「这一轮要 AI 干什么」。
 *
 * 和 system prompt 分开:system 是设定(每轮基本不变,便于服务端缓存),
 * 这一段才是本轮指令。原型把两者拼成一个巨大字符串塞进 system,
 * 既浪费缓存,也让模型分不清「设定」和「现在要我干嘛」。
 */
export function buildUserTurn({ kind, choice, playerName, opening }) {
    const who = playerName || '玩家';
    if (kind === 'start') {
        const hint = String(opening || '').trim();
        return [
            `请写下开场的第一幕。${who}是玩家操作的角色。`,
            hint ? `开场要求: ${hint}` : '交代清楚时间、地点、和谁在一起,然后停在一个需要玩家做选择的地方。',
        ].join('\n');
    }
    if (kind === 'custom') {
        return `${who}决定这样做: 「${String(choice || '').trim()}」\n\n顺着这个走向写下一幕。玩家的想法可能不在你原本的预想里,不要生硬地拉回去,也不要直接照抄他这句话当台词。`;
    }
    return `${who}选择了: 「${String(choice || '').trim()}」\n\n写下这个选择带来的下一幕。`;
}

/**
 * 生成整份剧本时的本轮指令。
 *
 * 和上面同一个道理:设定放 system(便于缓存),「现在要你干嘛」放这一段。
 */
export function buildScriptUserTurn({ playerName } = {}) {
    const who = playerName || '玩家';
    return `按上面的【剧本格式】,把【我的游戏流程】写成一份完整的剧本文件。${who}是玩家操作的角色。

从 [TITLE] 开始,到最后一个 [ENDING] 结束。只输出文件内容本身。`;
}

// ============================================================
// 剧本(一次写完整份预设流程)
// ============================================================

/**
 * 「指导 prompt」。
 *
 * 用户把自己写的**游戏流程**丢进来,这里拼出一份可以整段复制、
 * 交给任意外部 AI 的说明书;有 API 的话同一份直接发出去(`store.generateScript`)。
 *
 * ★ 走的是**同一个 composer**、同一套 `XX须知 / Principle / Behaviors` 文体、
 *   同一个 `nook-bridge` 数据源。这里唯一不同的是段落清单换成了
 *   `SCRIPT_SECTIONS` —— 因为「一次写完整棵树」和「一次写一小段」
 *   是两种互相打架的指令,不能塞进同一份 prompt。
 *
 * @param {object} ctx
 * @param {object} ctx.game
 * @param {object} ctx.sources    `collectSources()` 的结果
 * @param {string} ctx.flowText   用户自己写的游戏流程
 * @param {object} [ctx.budget]   `{ nodeCount, branches, endings }`
 * @param {object} [opts]
 * @param {boolean} [opts.save]   false = 只预览不写快照
 * @returns {{ text:string, parts:Array, stats:object }}
 */
export function buildScriptPrompt(ctx = {}, opts = {}) {
    const { game, sources, flowText } = ctx;
    const budget = { ...SCRIPT_BUDGET, ...(ctx.budget || {}) };

    const bodies = {
        role: buildScriptRolePart({ game, budget }),
        world: buildWorldPart({ world: sources?.world, clips: sources?.clips }),
        player: buildPlayerPart({ game, playerCard: sources?.playerCard }),
        cast: buildScriptCastPart({ cast: sources?.cast }),
        scenes: buildScenesPart({ scenes: sources?.scenes }),
        flow: buildFlowPart({ flowText }),
        budget: buildBudgetPart({ budget }),
        format: SCRIPT_FORMAT_DOC,
        example: SCRIPT_EXAMPLE,
        rules: buildScriptRulesPart({ budget }),
    };

    const parts = SCRIPT_SECTIONS.map((meta) => ({
        id: meta.id,
        title: meta.label,
        tag: meta.tag,
        content: bodies[meta.id] || '',
        active: true,
        locked: meta.locked === true,
        source: meta.desc,
    }));

    if (opts.save === false) return composer.compose(parts);
    return composer.composeAndSave(`script::${game?.id || 'none'}`, parts);
}

function buildScriptRolePart({ game, budget }) {
    const genre = genreLabel(game?.genre);
    return `剧本编剧须知:
  - Principle: 你要交付的是一份**可以直接导入湛蓝回忆的剧本文件**,不是小说,也不是分集大纲。
  - Behaviors:
    - 把整个故事拆成若干个 [NODE],一个 [NODE] 就是玩家在屏幕上看到的一屏 ——
      三到五句话,写到「该玩家做选择了」就停
    - 【我的游戏流程】是这次要改编的骨架:顺着它铺,不要另起炉灶,也不要只把它复述一遍
    - **绝不替玩家说话、不替玩家做决定**。玩家角色的言行只出现在选项里
    - 人物言行必须符合【角色】里的设定,不要临时给人物加设定
    - 分支要真的不一样:同一幕的几条选项应该通向内容不同的后续,而不是换个说法回到同一段
    - 至少写 ${budget.endings} 个不同的 [ENDING],让玩家重玩一次能看到别的东西
    - 不写色情、裸露、性暗示,也不按「表情、姿势、服装」去铺人物
    - 这是${genre || '视觉小说'};直接开始写文件,不要解释你打算怎么写`;
}

/**
 * 出场角色(剧本版)。
 *
 * ★ 名字必须是 nook 里的**真名** —— `parseScript` 靠名册认「谁在说话」,
 *   AI 自己编一个名字出来,那几句台词会被当成旁白,名牌整幕都不显示。
 */
function buildScriptCastPart({ cast }) {
    const list = asArray(cast).filter((c) => c.enabled);
    if (!list.length) return '';
    const body = list
        .map((c) => {
            const detail = nook.describeAi(c.ai);
            const note = c.note ? `本作设定: ${c.note}` : '';
            const role = c.isNpc ? '(配角/NPC)' : '(主要角色)';
            return [`【${c.ai.name}】${role}`, detail, note].filter(Boolean).join('\n');
        })
        .join('\n\n');
    const names = list.map((c) => c.ai.name).join(' / ');
    return `${body}\n\n注意: [NAME] 里只能写这几个名字,一个字都不能差: ${names}。写别的名字会被当成旁白。`;
}

function buildFlowPart({ flowText }) {
    const text = String(flowText || '').trim();
    if (!text) return '';
    return `${text}\n\n注意: 以上是**这个故事要讲什么**,不是格式要求。把它铺成一棵有分支的树。`;
}

function buildBudgetPart({ budget }) {
    return kvBlock([
        ['总幕数', `${budget.nodeCount} 幕左右(少几幕多几幕都行,但不要只有两三幕)`],
        ['每幕选项', `${budget.branches} 条`],
        ['结局数', `至少 ${budget.endings} 个`],
    ]);
}

function buildScriptRulesPart({ budget }) {
    return `硬性要求:
  - Principle: 这份输出会被程序逐行解析,格式错一处整份都导不进去。
  - Behaviors:
    - **只输出剧本文件本身**:不要「好的,以下是…」这类开场白,不要结尾总结,不要 markdown 围栏
    - 每个 [NODE] 的标签只能用英文字母 / 数字 / 下划线,全文不能重复
    - **每条选项后面必须有 [GOTO]目标标签[/GOTO]**,目标必须是文件里真实存在的 [NODE]
    - 一个 [NODE] 只能被一条选项指向 —— 这是一棵树不是流程图,两条线不能汇合到同一幕
    - **至少要有一个 [ENDING]**(这份剧本要 ${budget.endings} 个);写了 [ENDING] 的那一幕不要再写 [OPTIONS]
    - 每一幕都要有 [TEXT] 正文,不能只有选项`;
}

// ============================================================
// 附属调用
// ============================================================

/**
 * 好感度判定。
 *
 * ★ 原型这里有个很隐蔽的坑:`initializeAffectionSystem()` 会把
 *   `affectionSystem.characters` **整个清空重建成 50**,而
 *   `saveWorldviewConfig()` 每次保存都会调它 —— 也就是说
 *   **进设置页点一下「保存配置」,攒了几十轮的好感度全部归零**,还不提示。
 *   现在好感度只由本函数的结果增量更新,配置保存只补齐新角色、不动已有值。
 */
export function buildAffectionPrompt({ cast, affection, recent, choice }) {
    const roster = asArray(cast)
        .filter((c) => c.enabled && c.trackAffection)
        .map((c) => `- ${c.ai.name}(id=${c.ai.id}): 当前 ${affection?.[c.ai.id]?.value ?? 50}`)
        .join('\n');

    return `好感度判定须知:
  - Principle: 读刚发生的这一幕,判断每个角色对玩家的好感变化,只输出 JSON。
  - Behaviors:
    - change 是**增量**,范围 -10 ~ +10 的整数;这一幕没互动到的角色给 0
    - thoughts 是这个角色此刻心里那一句话,15 字以内,用她自己的口吻
    - 只输出 JSON,不要围栏、不要解释
    - id 必须原样使用下面给出的 id,不要改成名字

角色:
${roster || '(无)'}

玩家这一步: ${String(choice || '(开场)')}

刚发生的剧情:
${truncate(recent, 1200)}

输出:
{"updates":[{"id":"角色id","change":0,"thoughts":"..."}]}`;
}

/** 主线完成度判定 */
export function buildQuestPrompt({ quest, recent }) {
    return `任务判定须知:
  - Principle: 读下面的剧情,判断这条主线是不是真的达成了,只输出 JSON。
  - Behaviors:
    - 只有剧情里**明确发生了**才算完成,「看起来快了」「有希望」都算没完成
    - reason 一句话说明依据,30 字以内
    - 只输出 JSON,不要围栏、不要解释

主线: ${quest?.title || '(未设置)'}
目标: ${quest?.description || '(未描述)'}

剧情:
${truncate(recent, 1600)}

输出:
{"completed":false,"reason":"..."}`;
}

/** CG 画面描述 —— 相册里的一瞬,不是立绘提示词 */
export function buildCgPrompt({ recent, world }) {
    return `画面描述须知:
  - Principle: 把刚才这一幕里最值得留下来的一个瞬间,写成一段像随手拍下的生活照片。不是立绘,不是角色卡,也不是拿去文生图的提示词。
  - Behaviors:
    - title 6 字以内,像相册里随手起的名字
    - description 80~140 字:先写在哪儿、有什么光、桌上或路边有什么;人如果在场,只写他们在做什么
    - 只描述**看得见的东西**,不要写心理活动和剧情解释
    - 不要按「表情、姿势、服装」来写人,不要写身材、裸露、性暗示
    - 不要 NSFW,不要把别人的角色卡画成图,不要写成广告
    - 只输出 JSON,不要围栏

${world?.name ? `世界: ${world.name}\n` : ''}剧情:
${truncate(recent, 1200)}

输出:
{"title":"...","description":"..."}`;
}

/** 读上一次拼好的快照(「上次发出去的是什么」) */
export function readLastPrompt(gameId, nodeId) {
    return composer.load(`${gameId || 'none'}::${nodeId || 'root'}`);
}
